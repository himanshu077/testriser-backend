import OpenAI from 'openai';
import { db } from '../config/database';
import { aiUsageTracking } from '../models/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// OpenAI pricing per 1K tokens (as of 2024)
const PRICING = {
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// Subscription tier limits
const TIER_LIMITS = {
  free: { dailyQuestions: 5, model: 'gpt-3.5-turbo', maxTokens: 500 },
  trial: { dailyQuestions: 10, model: 'gpt-3.5-turbo', maxTokens: 800 },
  pro: { dailyQuestions: 50, model: 'gpt-4-turbo', maxTokens: 1000 },
  platinum: { dailyQuestions: 100, model: 'gpt-4-turbo', maxTokens: 1200 },
  elite: { dailyQuestions: 999999, model: 'gpt-4', maxTokens: 1500 },
};

type SubscriptionTier = 'free' | 'trial' | 'pro' | 'platinum' | 'elite';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  tokenCount: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  processingTimeMs: number;
  cost: number;
}

class OpenAIService {
  private client: OpenAI;
  private isInitialized: boolean = false;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Initialize OpenAI client
   */
  initializeClient() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.isInitialized = true;
  }

  /**
   * Build system prompt for NCERT tutor
   */
  buildSystemPrompt(subject: string, chapter: string): string {
    return `You are an expert NCERT tutor specializing in ${subject} for Class 11 and 12 students preparing for NEET.
You are currently helping with Chapter: "${chapter}"

Guidelines:
1. Provide line-by-line explanations from NCERT textbooks when relevant
2. Use simple, student-friendly language
3. Include relevant diagram descriptions when applicable
4. Reference NCERT page numbers when possible (if you know them)
5. Keep answers concise but comprehensive (max 500 words unless question requires more detail)
6. If the question is outside this chapter, politely redirect to the relevant chapter or provide a brief answer

Answer format:
- Start with a brief summary
- Provide detailed explanation with examples
- End with key points to remember

Focus on conceptual understanding and NEET exam preparation.`;
  }

  /**
   * Select model based on subscription tier
   */
  selectModelBasedOnTier(tier: SubscriptionTier): string {
    const tierConfig = TIER_LIMITS[tier] || TIER_LIMITS.free;
    return tierConfig.model;
  }

  /**
   * Get max tokens for subscription tier
   */
  getMaxTokensForTier(tier: SubscriptionTier): number {
    const tierConfig = TIER_LIMITS[tier] || TIER_LIMITS.free;
    return tierConfig.maxTokens;
  }

  /**
   * Estimate cost based on tokens and model
   */
  estimateCost(promptTokens: number, completionTokens: number, model: string): number {
    const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-3.5-turbo'];
    const promptCost = (promptTokens / 1000) * pricing.input;
    const completionCost = (completionTokens / 1000) * pricing.output;
    return promptCost + completionCost;
  }

  /**
   * Check rate limiting for user/session
   */
  async handleRateLimiting(
    userId?: string,
    sessionId?: string,
    tier: SubscriptionTier = 'free'
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const tierConfig = TIER_LIMITS[tier];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Build filter conditions
      const conditions = [gte(aiUsageTracking.date, today)];

      if (userId) {
        conditions.push(eq(aiUsageTracking.userId, userId));
      } else if (sessionId) {
        conditions.push(eq(aiUsageTracking.sessionId, sessionId));
      }

      // Query usage for today
      const result = await db
        .select({
          totalQuestions: sql<number>`SUM(${aiUsageTracking.questionCount})::int`,
        })
        .from(aiUsageTracking)
        .where(and(...conditions));
      const usedToday = result[0]?.totalQuestions || 0;
      const remaining = Math.max(0, tierConfig.dailyQuestions - usedToday);

      return {
        allowed: remaining > 0,
        remaining,
        limit: tierConfig.dailyQuestions,
      };
    } catch (error) {
      console.error('Rate limiting check error:', error);
      // Allow request if rate limit check fails
      return {
        allowed: true,
        remaining: tierConfig.dailyQuestions,
        limit: tierConfig.dailyQuestions,
      };
    }
  }

  /**
   * Track usage in database
   */
  async trackUsage(
    tokens: number,
    cost: number,
    model: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build filter conditions
      const conditions = [gte(aiUsageTracking.date, today), eq(aiUsageTracking.model, model)];

      if (userId) {
        conditions.push(eq(aiUsageTracking.userId, userId));
      } else if (sessionId) {
        conditions.push(eq(aiUsageTracking.sessionId, sessionId));
      }

      // Check if entry exists for today
      const existing = await db
        .select()
        .from(aiUsageTracking)
        .where(and(...conditions));

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(aiUsageTracking)
          .set({
            questionCount: sql`${aiUsageTracking.questionCount} + 1`,
            totalTokensUsed: sql`${aiUsageTracking.totalTokensUsed} + ${tokens}`,
            totalCostUsd: sql`${aiUsageTracking.totalCostUsd} + ${cost}`,
            updatedAt: new Date(),
          })
          .where(eq(aiUsageTracking.id, existing[0].id));
      } else {
        // Create new record
        await db.insert(aiUsageTracking).values({
          userId: userId || null,
          sessionId: sessionId || null,
          date: today,
          questionCount: 1,
          totalTokensUsed: tokens,
          totalCostUsd: cost.toString(),
          model,
        });
      }
    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't throw - tracking failure shouldn't block the response
    }
  }

  /**
   * Generate AI chat response
   */
  async generateChatResponse(params: {
    messages: ChatMessage[];
    subject: string;
    chapter: string;
    userTier?: SubscriptionTier;
    maxTokens?: number;
    userId?: string;
    sessionId?: string;
  }): Promise<AIResponse> {
    const { messages, subject, chapter, userTier = 'free', maxTokens, userId, sessionId } = params;

    // Initialize if not already done
    if (!this.isInitialized) {
      this.initializeClient();
    }

    // Check rate limiting
    const rateLimit = await this.handleRateLimiting(userId, sessionId, userTier);
    if (!rateLimit.allowed) {
      throw new Error(
        `Daily limit reached. You have ${rateLimit.remaining} out of ${rateLimit.limit} questions remaining.`
      );
    }

    // Select model and token limit
    const model = this.selectModelBasedOnTier(userTier);
    const tokenLimit = maxTokens || this.getMaxTokensForTier(userTier);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(subject, chapter);

    // Prepare messages with system prompt
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-5), // Only include last 5 messages for context
    ];

    const startTime = Date.now();

    try {
      // Call OpenAI API
      const completion = await this.client.chat.completions.create({
        model,
        messages: fullMessages,
        max_tokens: tokenLimit,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        user: userId || sessionId || undefined, // For abuse monitoring
      });

      const processingTimeMs = Date.now() - startTime;

      // Extract response
      const content = completion.choices[0]?.message?.content || '';
      const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      // Calculate cost
      const cost = this.estimateCost(usage.prompt_tokens, usage.completion_tokens, model);

      // Track usage
      await this.trackUsage(usage.total_tokens, cost, model, userId, sessionId);

      return {
        content,
        tokenCount: {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
        },
        model,
        processingTimeMs,
        cost,
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error);

      // Handle specific OpenAI errors
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.status === 400) {
        throw new Error('Invalid request. Please try rephrasing your question.');
      } else if (error.status === 500 || error.status === 503) {
        throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
      } else {
        throw new Error('Failed to generate response. Please try again.');
      }
    }
  }

  /**
   * Get daily usage summary for a user
   */
  async getDailyUsage(
    userId?: string,
    sessionId?: string
  ): Promise<{
    questionsToday: number;
    tokensToday: number;
    costToday: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build filter conditions
      const conditions = [gte(aiUsageTracking.date, today)];

      if (userId) {
        conditions.push(eq(aiUsageTracking.userId, userId));
      } else if (sessionId) {
        conditions.push(eq(aiUsageTracking.sessionId, sessionId));
      }

      const result = await db
        .select({
          totalQuestions: sql<number>`SUM(${aiUsageTracking.questionCount})::int`,
          totalTokens: sql<number>`SUM(${aiUsageTracking.totalTokensUsed})::int`,
          totalCost: sql<number>`SUM(${aiUsageTracking.totalCostUsd})::numeric`,
        })
        .from(aiUsageTracking)
        .where(and(...conditions));

      const costValue = result[0]?.totalCost;
      const costNumber = typeof costValue === 'string' ? parseFloat(costValue) : costValue || 0;

      return {
        questionsToday: result[0]?.totalQuestions || 0,
        tokensToday: result[0]?.totalTokens || 0,
        costToday: costNumber,
      };
    } catch (error) {
      console.error('Error fetching daily usage:', error);
      return { questionsToday: 0, tokensToday: 0, costToday: 0 };
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();
