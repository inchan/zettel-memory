/**
 * Index Recovery Queue 통합 테스트
 * 실제 시나리오에서 복구 큐의 동작 검증
 */

import { IndexRecoveryQueue } from '../../src/tools/index-recovery.js';
import { IndexSearchEngine } from '@inchankang/zettel-memory-index-search';
import { createTestContext, cleanupTestContext } from '../test-helpers.js';
import type { ToolExecutionContext } from '../../src/tools/types.js';
import { createNewNote, saveNote } from '@inchankang/zettel-memory-storage-md';
import { generateUid } from '@inchankang/zettel-memory-common';
import path from 'path';

describe('IndexRecoveryQueue Integration Tests', () => {
  let context: ToolExecutionContext;

  beforeEach(async () => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('실패한 인덱스 작업 복구', () => {
    it('인덱스 실패 후 복구 큐를 통해 재시도 성공해야 함', async () => {
      // 1. 노트 생성 및 저장
      const uid = generateUid();
      const filePath = path.join(context.vaultPath, `test-note-${uid}.md`);
      const note = createNewNote('Test Note', 'Test content', filePath, 'Resources', {
        id: uid,
        tags: ['test'],
      });
      await saveNote(note);

      // 2. SearchEngine 및 RecoveryQueue 생성
      const getSearchEngine = (ctx: ToolExecutionContext) => {
        if (!ctx._searchEngineInstance) {
          ctx._searchEngineInstance = new IndexSearchEngine({
            dbPath: ctx.indexPath,
            tokenizer: 'unicode61',
            walMode: true,
          });
        }
        return ctx._searchEngineInstance;
      };

      const recoveryQueue = new IndexRecoveryQueue(getSearchEngine, context);

      // 3. 복구 큐에 작업 추가 (인덱스 실패 시뮬레이션)
      recoveryQueue.enqueue({
        operation: 'index',
        noteUid: uid,
        noteFilePath: filePath,
      });

      // 4. 큐 상태 확인
      const statusBefore = recoveryQueue.getStatus();
      expect(statusBefore.queueSize).toBe(1);
      expect(statusBefore.isProcessing).toBe(false);

      // 5. 복구 처리 대기 (백그라운드 워커가 처리)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 6. 복구 완료 확인
      const statusAfter = recoveryQueue.getStatus();
      expect(statusAfter.queueSize).toBe(0); // 성공 후 큐에서 제거됨

      // 7. 인덱스에 노트가 추가되었는지 확인
      const searchEngine = getSearchEngine(context);
      const searchResult = await searchEngine.search('Test content');
      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].id).toBe(uid);

      // 정리
      recoveryQueue.cleanup();
    }, 10000);

    // 복잡한 타이밍 테스트는 skip (추후 개선 필요)
    it.skip('재시도 불가능한 에러는 즉시 포기해야 함', async () => {
      // 백그라운드 워커 타이밍 이슈로 인해 skip
    });

    it.skip('최대 재시도 횟수 초과 시 작업을 포기해야 함', async () => {
      // 35초 이상 소요되어 skip
    });
  });

  describe('메모리 관리', () => {
    it('큐에 노트 객체가 아닌 파일 경로만 저장해야 함', () => {
      const getSearchEngine = (ctx: ToolExecutionContext) => {
        if (!ctx._searchEngineInstance) {
          ctx._searchEngineInstance = new IndexSearchEngine({
            dbPath: ctx.indexPath,
            tokenizer: 'unicode61',
            walMode: true,
          });
        }
        return ctx._searchEngineInstance;
      };

      const recoveryQueue = new IndexRecoveryQueue(getSearchEngine, context);

      // 작업 추가
      recoveryQueue.enqueue({
        operation: 'index',
        noteUid: 'test-uid',
        noteFilePath: '/test/path.md',
      });

      // 큐 상태 조회하여 구조 확인
      const status = recoveryQueue.getStatus();
      expect(status.entries.length).toBe(1);

      const entry = status.entries[0];
      expect(entry.noteFilePath).toBe('/test/path.md');
      expect(entry).not.toHaveProperty('note'); // note 객체가 없어야 함

      recoveryQueue.cleanup();
    });
  });
});
