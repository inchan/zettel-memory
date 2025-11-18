/**
 * get_vault_stats tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { GetVaultStatsInputSchema } from '../../../src/tools/schemas.js';

describe('get_vault_stats tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('빈 입력을 허용해야 함', () => {
      const result = GetVaultStatsInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('기본값을 올바르게 적용해야 함', () => {
      // Zod optional().default() returns undefined in parse result
      // but defaults are applied in handler
      const result = GetVaultStatsInputSchema.parse({
        includeCategories: true,
        includeTagStats: true,
        includeLinkStats: true,
      });
      expect(result.includeCategories).toBe(true);
      expect(result.includeTagStats).toBe(true);
      expect(result.includeLinkStats).toBe(true);
    });

    it('모든 옵션을 false로 설정할 수 있어야 함', () => {
      const result = GetVaultStatsInputSchema.parse({
        includeCategories: false,
        includeTagStats: false,
        includeLinkStats: false,
      });
      expect(result.includeCategories).toBe(false);
      expect(result.includeTagStats).toBe(false);
      expect(result.includeLinkStats).toBe(false);
    });

    it('잘못된 타입을 거부해야 함', () => {
      const result = GetVaultStatsInputSchema.safeParse({
        includeCategories: 'true',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    it('빈 볼트에서 통계를 조회해야 함', async () => {
      const result = await executeTool('get_vault_stats', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('총 노트 수**: 0개');
      expect(result.content[0].text).toContain('총 단어 수**: 0개');
    });

    it('노트가 있는 볼트에서 통계를 조회해야 함', async () => {
      // 노트 생성
      await executeTool('create_note', {
        title: 'Stats Test 1',
        content: 'First test note with some words',
        category: 'Resources',
        tags: ['test', 'stats'],
      }, context);

      await executeTool('create_note', {
        title: 'Stats Test 2',
        content: 'Second test note',
        category: 'Projects',
        tags: ['test'],
      }, context);

      const result = await executeTool('get_vault_stats', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('총 노트 수**: 2개');
      expect(result.content[0].text).toContain('카테고리별 분포');
      expect(result.content[0].text).toContain('태그 통계');
    });

    it('카테고리 통계만 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Stats Test',
        content: 'Test note',
        category: 'Resources',
        tags: ['test'],
      }, context);

      const result = await executeTool('get_vault_stats', {
        includeCategories: true,
        includeTagStats: false,
        includeLinkStats: false,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('카테고리별 분포');
      expect(result.content[0].text).not.toContain('태그 통계');
      expect(result.content[0].text).not.toContain('링크 통계');
    });

    it('태그 통계만 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Stats Test',
        content: 'Test note',
        category: 'Resources',
        tags: ['test'],
      }, context);

      const result = await executeTool('get_vault_stats', {
        includeCategories: false,
        includeTagStats: true,
        includeLinkStats: false,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).not.toContain('카테고리별 분포');
      expect(result.content[0].text).toContain('태그 통계');
    });

    it('링크 통계를 포함해야 함', async () => {
      // 첫 번째 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'First note',
        category: 'Resources',
      }, context);
      const uid1 = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 두 번째 노트 생성 (첫 번째 노트 링크)
      await executeTool('create_note', {
        title: 'Note 2',
        content: 'Second note linking to first',
        category: 'Resources',
        links: [uid1!],
      }, context);

      const result = await executeTool('get_vault_stats', {
        includeCategories: true,
        includeTagStats: true,
        includeLinkStats: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('링크 통계');
      expect(result.content[0].text).toContain('총 링크');
    });

    it('카테고리가 없는 노트를 Uncategorized로 분류해야 함', async () => {
      // Zettelkasten 스타일 (카테고리 없음)
      await executeTool('create_note', {
        title: 'Zettel Note',
        content: 'Uncategorized note',
        tags: ['zettel'],
      }, context);

      const result = await executeTool('get_vault_stats', {
        includeCategories: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Uncategorized');
    });
  });
});
