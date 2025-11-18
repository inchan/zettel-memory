import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { logger as baseLogger } from '@inchankang/zettel-memory-common';
import type { z } from 'zod';
import type { ExecutionPolicyOptions } from './execution-policy.js';
import type { ToolName } from './schemas.js';
import type { IndexSearchEngine } from '@inchankang/zettel-memory-index-search';
import type { IndexRecoveryQueue } from './index-recovery.js';

export type LoggerLike = Pick<
  typeof baseLogger,
  'debug' | 'info' | 'warn' | 'error'
>;

export interface ToolExecutionContext {
  vaultPath: string;
  indexPath: string;
  mode: 'dev' | 'prod';
  logger: LoggerLike;
  policy: ExecutionPolicyOptions;
  /**
   * SearchEngine instance (managed by server or test context)
   * @internal
   */
  _searchEngineInstance?: IndexSearchEngine;
  /**
   * Index recovery queue for failed index operations
   * @internal
   */
  _recoveryQueue?: IndexRecoveryQueue;
}

export type ToolResult = CallToolResult;

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: ToolName;
  description: string;
  schema: TSchema;
  handler: (
    _input: z.infer<TSchema>,
    _context: ToolExecutionContext
  ) => Promise<ToolResult>;
}

export type AnyToolDefinition = ToolDefinition<z.ZodTypeAny>;
