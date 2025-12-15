import { db } from '../config/database';
import { apiCostTracking } from '../models/schema';
import { eq } from 'drizzle-orm';

// Pricing per 1M tokens (as of December 2024)
const PRICING = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gemini-1.5-flash-latest': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
  'gemini-2.0-flash-exp': { input: 0.0 / 1_000_000, output: 0.0 / 1_000_000 }, // Free during preview
};

export interface ApiCostTrackingParams {
  bookId: string;
  apiProvider: 'openai' | 'gemini';
  modelName: string;
  operationType: string;
  inputTokens: number;
  outputTokens: number;
  pageNumber?: number;
  success?: boolean;
  errorMessage?: string;
  processingTimeMs?: number;
}

export class ApiCostTracker {
  /**
   * Track an API call and calculate its cost
   */
  static async track(params: ApiCostTrackingParams): Promise<void> {
    try {
      const pricing = PRICING[params.modelName as keyof typeof PRICING] || {
        input: 0,
        output: 0,
      };
      const cost = params.inputTokens * pricing.input + params.outputTokens * pricing.output;

      await db.insert(apiCostTracking).values({
        bookId: params.bookId,
        apiProvider: params.apiProvider,
        modelName: params.modelName,
        operationType: params.operationType,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens,
        estimatedCostUsd: cost.toFixed(6),
        pageNumber: params.pageNumber || null,
        success: params.success !== false,
        errorMessage: params.errorMessage || null,
        processingTimeMs: params.processingTimeMs || null,
      });
    } catch (error: any) {
      // Don't throw - cost tracking failure shouldn't break extraction
      console.error('⚠️  Failed to track API cost:', error.message);
    }
  }

  /**
   * Get cost summary for a book
   */
  static async getBookCostSummary(bookId: string) {
    try {
      const costs = await db
        .select()
        .from(apiCostTracking)
        .where(eq(apiCostTracking.bookId, bookId));

      const totalCost = costs.reduce((sum, c) => sum + parseFloat(c.estimatedCostUsd || '0'), 0);
      const totalTokens = costs.reduce((sum, c) => sum + (c.totalTokens || 0), 0);
      const successfulCalls = costs.filter((c) => c.success).length;
      const failedCalls = costs.filter((c) => !c.success).length;

      const byProvider = {
        openai: costs.filter((c) => c.apiProvider === 'openai').length,
        gemini: costs.filter((c) => c.apiProvider === 'gemini').length,
      };

      const byOperation = costs.reduce(
        (acc, c) => {
          acc[c.operationType] = (acc[c.operationType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalCost,
        totalTokens,
        successfulCalls,
        failedCalls,
        totalCalls: costs.length,
        byProvider,
        byOperation,
      };
    } catch (error: any) {
      console.error('⚠️  Failed to get cost summary:', error.message);
      return {
        totalCost: 0,
        totalTokens: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalCalls: 0,
        byProvider: { openai: 0, gemini: 0 },
        byOperation: {},
      };
    }
  }
}
