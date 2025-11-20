/**
 * Index Recovery Queue
 * 인덱스 업데이트 실패 시 백그라운드에서 재시도하는 복구 메커니즘
 */

import type { ToolExecutionContext } from './types.js';
import type { IndexSearchEngine } from '@inchankang/zettel-memory-index-search';
import { loadNote } from '@inchankang/zettel-memory-storage-md';
import { RECOVERY_QUEUE_DEFAULTS } from '@inchankang/zettel-memory-common';

export type IndexOperation = 'index' | 'update' | 'delete';

export interface RecoveryQueueEntry {
  operation: IndexOperation;
  noteUid: string;
  noteFilePath?: string; // index/update 작업에만 필요 (delete는 UID만 필요)
  timestamp: number;
  retries: number;
  lastError?: string;
}

/**
 * 인덱스 복구 큐 관리자
 */
export class IndexRecoveryQueue {
  private queue: RecoveryQueueEntry[] = [];
  private isProcessing = false;
  private maxRetries = RECOVERY_QUEUE_DEFAULTS.MAX_RETRIES;
  private baseDelayMs = RECOVERY_QUEUE_DEFAULTS.BASE_DELAY_MS;
  private workerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly getSearchEngine: (
      ctx: ToolExecutionContext
    ) => IndexSearchEngine,
    private readonly context: ToolExecutionContext
  ) { }

  /**
   * 실패한 인덱스 작업을 큐에 추가
   */
  enqueue(entry: Omit<RecoveryQueueEntry, 'timestamp' | 'retries'>): void {
    const queueEntry: RecoveryQueueEntry = {
      ...entry,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queueEntry);
    this.context.logger.debug('[IndexRecoveryQueue] 작업 추가', {
      operation: entry.operation,
      noteUid: entry.noteUid,
      queueSize: this.queue.length,
    });

    // 워커가 실행 중이 아니면 시작
    if (!this.isProcessing) {
      this.startWorker();
    }
  }

  /**
   * 백그라운드 워커 시작
   */
  private startWorker(): void {
    if (this.workerInterval) {
      return; // 이미 실행 중
    }

    this.context.logger.info('[IndexRecoveryQueue] 백그라운드 워커 시작');

    this.workerInterval = setInterval(() => {
      void this.processQueue();
    }, RECOVERY_QUEUE_DEFAULTS.WORKER_INTERVAL_MS);
  }

  /**
   * 백그라운드 워커 중지
   */
  private stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      this.context.logger.info('[IndexRecoveryQueue] 백그라운드 워커 중지');
    }
  }

  /**
   * 큐 처리 (재시도)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      const entriesToProcess = this.queue.filter(entry => {
        // 재시도 간격 계산 (exponential backoff)
        const delay = this.baseDelayMs * Math.pow(2, entry.retries);
        const nextRetryTime = entry.timestamp + delay;
        return now >= nextRetryTime;
      });

      for (const entry of entriesToProcess) {
        await this.processEntry(entry);
      }
    } finally {
      this.isProcessing = false;

      // 큐가 비었으면 워커 중지
      if (this.queue.length === 0) {
        this.stopWorker();
      }
    }
  }

  /**
   * 단일 엔트리 처리 (재시도)
   */
  private async processEntry(entry: RecoveryQueueEntry): Promise<void> {
    try {
      const searchEngine = this.getSearchEngine(this.context);

      // 작업 실행
      switch (entry.operation) {
        case 'index':
        case 'update': {
          if (!entry.noteFilePath) {
            throw new Error('File path is required for index/update operation');
          }

          // 파일에서 노트 로드 (메모리 절약)
          const note = await loadNote(entry.noteFilePath);
          searchEngine.indexNote(note);
          break;
        }
        case 'delete':
          searchEngine.removeNote(entry.noteUid);
          break;
      }

      // 성공 - 큐에서 제거
      this.removeFromQueue(entry.noteUid, entry.operation);
      this.context.logger.info('[IndexRecoveryQueue] 작업 성공', {
        operation: entry.operation,
        noteUid: entry.noteUid,
        retriesUsed: entry.retries,
      });
    } catch (error) {
      entry.retries += 1;
      entry.lastError = String(error);
      entry.timestamp = Date.now(); // 타임스탬프 업데이트 (다음 재시도 시간 계산용)

      // 재시도 불가능한 에러 판별
      const isRetriable = this.isRetriableError(error);

      if (!isRetriable || entry.retries >= this.maxRetries) {
        // 재시도 불가능하거나 최대 재시도 초과 - 큐에서 제거하고 로그
        this.removeFromQueue(entry.noteUid, entry.operation);
        this.context.logger.error('[IndexRecoveryQueue] 작업 포기', {
          operation: entry.operation,
          noteUid: entry.noteUid,
          retries: entry.retries,
          lastError: entry.lastError,
          reason: !isRetriable ? 'non-retriable error' : 'max retries exceeded',
        });
      } else {
        this.context.logger.warn(
          '[IndexRecoveryQueue] 작업 실패, 재시도 예정',
          {
            operation: entry.operation,
            noteUid: entry.noteUid,
            retries: entry.retries,
            nextRetryIn: `${this.baseDelayMs * Math.pow(2, entry.retries)}ms`,
          }
        );
      }
    }
  }

  /**
   * 에러가 재시도 가능한지 판별
   */
  private isRetriableError(error: unknown): boolean {
    // Node.js error code 체크
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code?: string }).code;
      const nonRetriableCodes = ['ENOENT', 'EACCES', 'EPERM', 'EISDIR'];
      if (errorCode && nonRetriableCodes.includes(errorCode)) {
        return false;
      }
    }

    // 에러 메시지 패턴 체크
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nonRetriablePatterns = [
      'does not exist', // 리소스 없음
      'not found', // 리소스 없음
      'invalid', // 유효하지 않은 데이터
      'malformed', // 잘못된 형식
    ];

    return !nonRetriablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 큐에서 항목 제거
   */
  private removeFromQueue(noteUid: string, operation: IndexOperation): void {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(
      e => !(e.noteUid === noteUid && e.operation === operation)
    );

    if (this.queue.length < initialLength) {
      this.context.logger.debug('[IndexRecoveryQueue] 작업 제거', {
        noteUid,
        operation,
        remainingItems: this.queue.length,
      });
    }
  }

  /**
   * 큐 상태 조회
   */
  getStatus(): {
    queueSize: number;
    isProcessing: boolean;
    entries: RecoveryQueueEntry[];
  } {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      entries: [...this.queue], // 복사본 반환
    };
  }

  /**
   * 정리 (서버 종료 시)
   */
  cleanup(): void {
    this.stopWorker();

    if (this.queue.length > 0) {
      this.context.logger.warn(
        '[IndexRecoveryQueue] 처리되지 않은 작업이 남아있음',
        {
          remainingItems: this.queue.length,
          items: this.queue.map(e => ({
            operation: e.operation,
            noteUid: e.noteUid,
            retries: e.retries,
          })),
        }
      );
    }

    this.queue = [];
  }
}
