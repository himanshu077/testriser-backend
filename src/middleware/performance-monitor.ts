/**
 * Performance Monitoring Middleware
 *
 * Tracks database query performance and connection pool metrics
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';

// Store query metrics
interface QueryMetric {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

interface ConnectionPoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
}

class PerformanceMonitor {
  private queryMetrics: QueryMetric[] = [];
  private readonly MAX_STORED_METRICS = 1000; // Keep last 1000 queries
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second in ms

  /**
   * Log query execution
   */
  logQuery(query: string, duration: number, success: boolean, error?: string): void {
    const metric: QueryMetric = {
      query: this.truncateQuery(query),
      duration,
      timestamp: new Date(),
      success,
      error,
    };

    this.queryMetrics.push(metric);

    // Keep only last MAX_STORED_METRICS
    if (this.queryMetrics.length > this.MAX_STORED_METRICS) {
      this.queryMetrics.shift();
    }

    // Log slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      console.warn(`[SLOW QUERY] ${duration}ms - ${this.truncateQuery(query, 200)}`);
    }

    // Log failed queries
    if (!success && error) {
      console.error(`[QUERY ERROR] ${error} - ${this.truncateQuery(query, 200)}`);
    }
  }

  /**
   * Truncate long queries for logging
   */
  private truncateQuery(query: string, maxLength: number = 100): string {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    if (this.queryMetrics.length === 0) {
      return null;
    }

    const totalQueries = this.queryMetrics.length;
    const successfulQueries = this.queryMetrics.filter((m) => m.success).length;
    const failedQueries = totalQueries - successfulQueries;

    const durations = this.queryMetrics.map((m) => m.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const slowQueries = this.queryMetrics.filter((m) => m.duration > this.SLOW_QUERY_THRESHOLD);

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      successRate: ((successfulQueries / totalQueries) * 100).toFixed(2) + '%',
      avgDuration: Math.round(avgDuration) + 'ms',
      minDuration: minDuration + 'ms',
      maxDuration: maxDuration + 'ms',
      slowQueries: slowQueries.length,
      slowQueryThreshold: this.SLOW_QUERY_THRESHOLD + 'ms',
    };
  }

  /**
   * Get recent slow queries
   */
  getSlowQueries(limit: number = 10) {
    return this.queryMetrics
      .filter((m) => m.duration > this.SLOW_QUERY_THRESHOLD)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map((m) => ({
        query: m.query,
        duration: m.duration + 'ms',
        timestamp: m.timestamp,
      }));
  }

  /**
   * Get recent failed queries
   */
  getFailedQueries(limit: number = 10) {
    return this.queryMetrics
      .filter((m) => !m.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
      .map((m) => ({
        query: m.query,
        error: m.error,
        timestamp: m.timestamp,
      }));
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): ConnectionPoolStats {
    // Access postgres.js connection pool stats
    // Note: postgres.js doesn't expose these directly, so we'll track what we can
    return {
      totalConnections: 10, // From config (max: 10)
      idleConnections: 0, // Not directly available
      activeConnections: 0, // Not directly available
      waitingRequests: 0, // Not directly available
    };
  }

  /**
   * Get database statistics from pg_stat_statements
   */
  async getDatabaseStats() {
    try {
      // Get total database size
      const sizeResult = await db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `);

      // Get table sizes
      const tableResult = await db.execute(sql`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY size_bytes DESC
        LIMIT 10;
      `);

      // Get active connections
      const connectionsResult = await db.execute(sql`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database();
      `);

      return {
        databaseSize: (sizeResult as any)[0]?.size || 'N/A',
        activeConnections: (connectionsResult as any)[0]?.active_connections || 0,
        topTables: (tableResult as any[]).map((row: any) => ({
          schema: row.schemaname,
          table: row.tablename,
          size: row.size,
        })),
      };
    } catch (error) {
      console.error('[PERFORMANCE MONITOR] Failed to get database stats:', error);
      return null;
    }
  }

  /**
   * Clear stored metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware to track request performance
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Track response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log slow API requests (>2 seconds)
    if (duration > 2000) {
      console.warn(
        `[SLOW REQUEST] ${req.method} ${req.path} - ${duration}ms - Status: ${res.statusCode}`
      );
    }
  });

  next();
}

/**
 * Drizzle query logger
 * Add this to drizzle config to track all queries
 */
export const drizzleLogger = {
  logQuery(query: string, _params: unknown[]): void {
    const startTime = Date.now();

    // This is a simple logger - in production you'd track actual execution time
    // Drizzle doesn't provide built-in hooks for this yet
    console.log(`[QUERY] ${query}`);

    // Simulate tracking (you'd need to wrap actual execution)
    performanceMonitor.logQuery(query, Date.now() - startTime, true);
  },
};

/**
 * Health check endpoint handler
 */
export async function healthCheckHandler(req: Request, res: Response) {
  try {
    // Test database connection
    const startTime = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    const dbLatency = Date.now() - startTime;

    // Get performance stats
    const queryStats = performanceMonitor.getQueryStats();
    const poolStats = performanceMonitor.getConnectionPoolStats();
    const dbStats = await performanceMonitor.getDatabaseStats();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latency: dbLatency + 'ms',
        stats: dbStats,
      },
      connectionPool: poolStats,
      queries: queryStats,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Performance metrics endpoint handler
 */
export async function metricsHandler(req: Request, res: Response) {
  try {
    const queryStats = performanceMonitor.getQueryStats();
    const slowQueries = performanceMonitor.getSlowQueries();
    const failedQueries = performanceMonitor.getFailedQueries();
    const poolStats = performanceMonitor.getConnectionPoolStats();
    const dbStats = await performanceMonitor.getDatabaseStats();

    res.json({
      timestamp: new Date().toISOString(),
      database: dbStats,
      connectionPool: poolStats,
      queries: {
        stats: queryStats,
        slowQueries,
        failedQueries,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default performanceMonitor;
