import Redis from 'ioredis';

/**
 * Smart Cache Service with Redis fallback
 * - Uses Redis when REDIS_URL is configured
 * - Falls back to in-memory cache for development
 */
class CacheService {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, { data: any; expiresAt: number }>();
  private isRedisAvailable = false;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection if REDIS_URL is provided
   */
  private initializeRedis() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('[Cache] No REDIS_URL found, using in-memory cache');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('[Cache] Redis connection failed, falling back to in-memory cache');
            this.isRedisAvailable = false;
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000); // Exponential backoff
        },
      });

      this.redis.on('connect', () => {
        this.isRedisAvailable = true;
        console.log('[Cache] Redis connected successfully');
      });

      this.redis.on('error', (err: Error) => {
        console.error('[Cache] Redis error:', err.message);
        this.isRedisAvailable = false;
      });

      this.redis.on('close', () => {
        console.warn('[Cache] Redis connection closed, using in-memory cache');
        this.isRedisAvailable = false;
      });
    } catch (error) {
      console.error('[Cache] Failed to initialize Redis:', error);
      this.redis = null;
      this.isRedisAvailable = false;
    }
  }

  /**
   * Get value from cache (Redis or in-memory)
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Try Redis first if available
      if (this.isRedisAvailable && this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      }

      // Fallback to in-memory cache
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }

      // Expired, remove it
      this.memoryCache.delete(key);
      return null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL (Redis or in-memory)
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds TTL in seconds (default: 300 = 5 minutes)
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      // Try Redis first if available
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      }

      // Fallback to in-memory cache
      this.memoryCache.set(key, {
        data: value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    } catch (error) {
      console.error('[Cache] Set error:', error);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key);
      }
      this.memoryCache.delete(key);
    } catch (error) {
      console.error('[Cache] Delete error:', error);
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.flushdb();
      }
      this.memoryCache.clear();
    } catch (error) {
      console.error('[Cache] Clear error:', error);
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      isRedisAvailable: this.isRedisAvailable,
      cacheType: this.isRedisAvailable ? 'Redis' : 'In-Memory',
      memoryEntries: this.memoryCache.size,
    };
  }

  /**
   * Close Redis connection gracefully
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cacheService.close();
});

process.on('SIGINT', async () => {
  await cacheService.close();
});
