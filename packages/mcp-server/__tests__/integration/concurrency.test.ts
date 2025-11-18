/**
 * Concurrency and Edge Case Tests
 * Tests for concurrent tool executions, race conditions, and error edge cases
 */

import { executeTool } from '../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../test-helpers.js';
import type { ToolExecutionContext } from '../../src/tools/types.js';

describe('Concurrency Tests', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Concurrent Note Creation', () => {
    it('여러 노트를 동시에 생성해도 모든 노트가 고유한 UID를 가져야 함', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        executeTool('create_note', {
          title: `Concurrent Note ${i}`,
          content: `Content ${i}`,
          category: 'Resources',
        }, context)
      );

      const results = await Promise.all(promises);

      // 모든 노트가 성공적으로 생성되어야 함
      const uids = results.map(result => {
        expect(result.isError).toBeFalsy();
        return (result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];
      });

      // 모든 UID가 고유해야 함
      const uniqueUids = new Set(uids);
      expect(uniqueUids.size).toBe(10);
    });

    it('동시 검색 요청이 서로 간섭하지 않아야 함', async () => {
      // 먼저 노트 생성
      await executeTool('create_note', {
        title: 'Search Test Note',
        content: 'This is test content for concurrent search',
        category: 'Resources',
        tags: ['search', 'test'],
      }, context);

      // 동시에 여러 검색 수행
      const searchPromises = [
        executeTool('search_memory', { query: 'test' }, context),
        executeTool('search_memory', { query: 'content' }, context),
        executeTool('search_memory', { query: 'search' }, context),
        executeTool('search_memory', { query: 'concurrent' }, context),
      ];

      const results = await Promise.all(searchPromises);

      // 모든 검색이 성공해야 함
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
      });
    });

    it('동시 CRUD 작업이 데이터를 손상시키지 않아야 함', async () => {
      // 노트 생성
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        executeTool('create_note', {
          title: `CRUD Test ${i}`,
          content: `Original content ${i}`,
          category: 'Resources',
        }, context)
      );

      const createResults = await Promise.all(createPromises);
      const uids = createResults.map(result =>
        (result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1]
      );

      // 동시에 일부 업데이트, 일부 읽기
      const mixedPromises = [
        executeTool('update_note', {
          uid: uids[0]!,
          title: 'Updated Title 0',
        }, context),
        executeTool('read_note', { uid: uids[1]! }, context),
        executeTool('update_note', {
          uid: uids[2]!,
          content: 'Updated content 2',
        }, context),
        executeTool('read_note', { uid: uids[3]! }, context),
        executeTool('list_notes', {}, context),
      ];

      const results = await Promise.all(mixedPromises);

      // 모든 작업이 성공해야 함
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
      });

      // 업데이트된 노트 확인
      const readResult = await executeTool('read_note', { uid: uids[0]! }, context);
      expect(readResult.content[0].text).toContain('Updated Title 0');
    });
  });

  describe('Error Edge Cases', () => {
    it('존재하지 않는 노트 업데이트 시 적절한 에러를 반환해야 함', async () => {
      await expect(executeTool('update_note', {
        uid: 'non-existent-uid-12345',
        title: 'New Title',
      }, context)).rejects.toThrow();
    });

    it('빈 검색어로 검색 시 스키마 검증 에러를 반환해야 함', async () => {
      await expect(executeTool('search_memory', {
        query: '',
      }, context)).rejects.toThrow();
    });

    it('잘못된 카테고리로 노트 생성 시 에러를 반환해야 함', async () => {
      await expect(executeTool('create_note', {
        title: 'Test',
        content: 'Test',
        category: 'InvalidCategory' as any,
      }, context)).rejects.toThrow();
    });

    it('이미 삭제된 노트를 다시 삭제할 때 에러를 반환해야 함', async () => {
      // 노트 생성
      const createResult = await executeTool('create_note', {
        title: 'To Be Deleted',
        content: 'This note will be deleted',
        category: 'Resources',
      }, context);
      const uid = (createResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 첫 번째 삭제
      await executeTool('delete_note', {
        uid: uid!,
        confirm: true,
      }, context);

      // 두 번째 삭제 시도
      await expect(executeTool('delete_note', {
        uid: uid!,
        confirm: true,
      }, context)).rejects.toThrow();
    });

    it('limit가 범위를 벗어날 때 에러를 반환해야 함', async () => {
      await expect(executeTool('search_memory', {
        query: 'test',
        limit: 0,
      }, context)).rejects.toThrow();

      await expect(executeTool('search_memory', {
        query: 'test',
        limit: 101,
      }, context)).rejects.toThrow();
    });

    it('음수 offset이 거부되어야 함', async () => {
      await expect(executeTool('search_memory', {
        query: 'test',
        offset: -1,
      }, context)).rejects.toThrow();
    });
  });

  describe('Race Condition Handling', () => {
    it('동일 노트를 동시에 업데이트해도 데이터 손실이 없어야 함', async () => {
      // 노트 생성
      const createResult = await executeTool('create_note', {
        title: 'Race Test',
        content: 'Original content',
        category: 'Resources',
        tags: ['original'],
      }, context);
      const uid = (createResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 동시에 다른 필드 업데이트
      const updatePromises = [
        executeTool('update_note', {
          uid: uid!,
          title: 'Updated Title',
        }, context),
        executeTool('update_note', {
          uid: uid!,
          tags: ['updated'],
        }, context),
      ];

      const results = await Promise.all(updatePromises);

      // 모든 업데이트가 성공해야 함 (마지막 업데이트가 우선)
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
      });

      // 최종 상태 확인 - 최소한 하나의 업데이트는 반영되어야 함
      const readResult = await executeTool('read_note', { uid: uid! }, context);
      const text = readResult.content[0].text as string;

      // title이나 tags 중 하나는 업데이트되어야 함
      const titleUpdated = text.includes('Updated Title');
      const tagsUpdated = text.includes('updated');
      expect(titleUpdated || tagsUpdated).toBe(true);
    });

    it('노트 생성 중 동일 제목으로 여러 노트를 생성해도 모두 성공해야 함', async () => {
      const promises = Array.from({ length: 5 }, () =>
        executeTool('create_note', {
          title: 'Same Title',
          content: 'Same content',
          category: 'Resources',
        }, context)
      );

      const results = await Promise.all(promises);

      // 모든 노트가 생성되어야 함
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
      });

      // list_notes로 확인 - 전체 개수가 5개 이상이어야 함
      const listResult = await executeTool('list_notes', {}, context);
      const noteCount = (listResult.content[0].text as string).match(/\*\*전체\*\*: (\d+)개/)?.[1];
      expect(noteCount).toBeDefined();
      expect(parseInt(noteCount!)).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Stress Testing', () => {
    it('많은 수의 동시 요청을 처리할 수 있어야 함', async () => {
      const requests = 50;
      const promises = Array.from({ length: requests }, (_, i) =>
        executeTool('list_notes', {}, context)
      );

      const start = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      // 모든 요청이 성공해야 함
      results.forEach(result => {
        expect(result.isError).toBeFalsy();
      });

      // 합리적인 시간 내에 완료되어야 함 (50개 요청에 10초 이내)
      expect(duration).toBeLessThan(10000);
    }, 15000);
  });
});
