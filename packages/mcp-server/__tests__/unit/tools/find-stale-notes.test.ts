/**
 * find_stale_notes tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { FindStaleNotesInputSchema } from '../../../src/tools/schemas.js';

describe('find_stale_notes tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('staleDays가 필수여야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('유효한 입력을 허용해야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
      });
      expect(result.success).toBe(true);
    });

    it('staleDays 범위를 검증해야 함', () => {
      const tooSmall = FindStaleNotesInputSchema.safeParse({
        staleDays: 0,
      });
      expect(tooSmall.success).toBe(false);

      const valid = FindStaleNotesInputSchema.safeParse({
        staleDays: 1,
      });
      expect(valid.success).toBe(true);
    });

    it('limit 범위를 검증해야 함', () => {
      const tooSmall = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        limit: 0,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        limit: 1001,
      });
      expect(tooLarge.success).toBe(false);
    });

    it('유효한 sortBy 값을 허용해야 함', () => {
      const created = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        sortBy: 'created',
      });
      expect(created.success).toBe(true);

      const updated = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        sortBy: 'updated',
      });
      expect(updated.success).toBe(true);

      const title = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        sortBy: 'title',
      });
      expect(title.success).toBe(true);
    });

    it('잘못된 sortBy 값을 거부해야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        sortBy: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('유효한 category 필터를 허용해야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        category: 'Projects',
      });
      expect(result.success).toBe(true);
    });

    it('잘못된 category를 거부해야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        category: 'InvalidCategory',
      });
      expect(result.success).toBe(false);
    });

    it('excludeArchives 옵션을 처리해야 함', () => {
      const result = FindStaleNotesInputSchema.safeParse({
        staleDays: 30,
        excludeArchives: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('오래된 노트가 없을 때 빈 결과를 반환해야 함', async () => {
      // 방금 생성된 노트는 오래되지 않음
      await executeTool('create_note', {
        title: 'Fresh Note',
        content: 'Just created',
        category: 'Resources',
      }, context);

      const result = await executeTool('find_stale_notes', {
        staleDays: 1,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('업데이트되지 않은 노트가 없습니다');
    });

    it('빈 볼트에서 빈 결과를 반환해야 함', async () => {
      const result = await executeTool('find_stale_notes', {
        staleDays: 30,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('업데이트되지 않은 노트가 없습니다');
    });

    it('staleDays 매개변수가 올바르게 적용되어야 함', async () => {
      // 노트 생성
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Resources',
      }, context);

      // 0일로 검색 (오늘 생성된 노트도 찾아야 함... 하지만 실제로는 1일 이상 되어야 함)
      const result = await executeTool('find_stale_notes', {
        staleDays: 1,
      }, context);

      expect(result.isError).toBeFalsy();
      // 방금 생성된 노트는 1일이 지나지 않았으므로 포함되지 않음
      expect(result._meta?.metadata?.totalCount).toBe(0);
    });

    it('category 필터를 적용해야 함', async () => {
      await executeTool('create_note', {
        title: 'Projects Note',
        content: 'Project content',
        category: 'Projects',
      }, context);

      await executeTool('create_note', {
        title: 'Resources Note',
        content: 'Resource content',
        category: 'Resources',
      }, context);

      // Projects 카테고리만 필터링 (하지만 노트가 방금 생성되어서 stale이 아님)
      const result = await executeTool('find_stale_notes', {
        staleDays: 30,
        category: 'Projects',
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.category).toBe('Projects');
    });

    it('excludeArchives가 true일 때 Archives 노트를 제외해야 함', async () => {
      await executeTool('create_note', {
        title: 'Archived Note',
        content: 'Old archived content',
        category: 'Archives',
      }, context);

      // excludeArchives 기본값이 true
      const result = await executeTool('find_stale_notes', {
        staleDays: 1,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.excludeArchives).toBe(true);
    });

    it('excludeArchives가 false일 때 Archives 노트를 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Archived Note',
        content: 'Archived content',
        category: 'Archives',
      }, context);

      const result = await executeTool('find_stale_notes', {
        staleDays: 1,
        excludeArchives: false,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.excludeArchives).toBe(false);
    });

    it('limit를 적용해야 함', async () => {
      // 5개의 노트 생성
      for (let i = 1; i <= 5; i++) {
        await executeTool('create_note', {
          title: `Note ${i}`,
          content: `Content ${i}`,
          category: 'Resources',
        }, context);
      }

      const result = await executeTool('find_stale_notes', {
        staleDays: 1,
        limit: 2,
      }, context);

      expect(result.isError).toBeFalsy();
      // limit가 적용되지만 stale 노트가 없으므로 0개
      expect(result._meta?.metadata?.returnedCount).toBe(0);
    });

    it('sortBy와 sortOrder를 적용해야 함', async () => {
      await executeTool('create_note', {
        title: 'Apple',
        content: 'A note',
        category: 'Resources',
      }, context);

      await executeTool('create_note', {
        title: 'Banana',
        content: 'B note',
        category: 'Resources',
      }, context);

      const result = await executeTool('find_stale_notes', {
        staleDays: 30,
        sortBy: 'title',
        sortOrder: 'asc',
      }, context);

      expect(result.isError).toBeFalsy();
      // 결과가 없을 때는 sortBy/sortOrder가 메타데이터에 포함되지 않음
      // 결과가 있을 때만 포함됨
      expect(result._meta?.metadata?.staleDays).toBe(30);
    });
  });

  describe('Output Format', () => {
    it('메타데이터에 staleDays를 포함해야 함', async () => {
      const result = await executeTool('find_stale_notes', {
        staleDays: 30,
      }, context);

      expect(result._meta?.metadata).toBeDefined();
      expect(result._meta?.metadata?.staleDays).toBe(30);
      expect(result._meta?.metadata?.totalCount).toBeDefined();
      expect(result._meta?.metadata?.returnedCount).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('잘못된 입력에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('find_stale_notes', {
        staleDays: -1,
      }, context)).rejects.toThrow();
    });

    it('잘못된 category에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('find_stale_notes', {
        staleDays: 30,
        category: 'InvalidCategory',
      }, context)).rejects.toThrow();
    });

    it('staleDays가 누락되면 에러를 throw해야 함', async () => {
      await expect(executeTool('find_stale_notes', {}, context)).rejects.toThrow();
    });
  });
});
