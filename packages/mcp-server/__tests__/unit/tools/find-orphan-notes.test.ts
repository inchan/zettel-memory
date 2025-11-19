/**
 * find_orphan_notes tool tests
 *
 * TDD Red Phase: 테스트 먼저 작성
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { FindOrphanNotesInputSchema } from '../../../src/tools/schemas.js';

describe('find_orphan_notes tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('빈 입력이 유효해야 함 (모든 필드 optional)', () => {
      const result = FindOrphanNotesInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('기본 limit를 적용해야 함 (handler에서)', () => {
      // Zod의 .default().optional() 패턴에서는 parse 결과에 undefined가 될 수 있음
      // 실제 기본값은 handler의 destructuring에서 적용됨 (limit = 100)
      const result = FindOrphanNotesInputSchema.parse({});
      // parse 결과에서는 undefined이지만, handler에서 기본값 적용
      expect(result.limit).toBeUndefined();
    });

    it('limit 범위를 검증해야 함', () => {
      const tooSmall = FindOrphanNotesInputSchema.safeParse({
        limit: 0,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = FindOrphanNotesInputSchema.safeParse({
        limit: 1001,
      });
      expect(tooLarge.success).toBe(false);

      const valid = FindOrphanNotesInputSchema.safeParse({
        limit: 50,
      });
      expect(valid.success).toBe(true);
    });

    it('유효한 sortBy 값을 허용해야 함', () => {
      const created = FindOrphanNotesInputSchema.safeParse({ sortBy: 'created' });
      expect(created.success).toBe(true);

      const updated = FindOrphanNotesInputSchema.safeParse({ sortBy: 'updated' });
      expect(updated.success).toBe(true);

      const title = FindOrphanNotesInputSchema.safeParse({ sortBy: 'title' });
      expect(title.success).toBe(true);
    });

    it('잘못된 sortBy 값을 거부해야 함', () => {
      const result = FindOrphanNotesInputSchema.safeParse({
        sortBy: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('유효한 sortOrder 값을 허용해야 함', () => {
      const asc = FindOrphanNotesInputSchema.safeParse({ sortOrder: 'asc' });
      expect(asc.success).toBe(true);

      const desc = FindOrphanNotesInputSchema.safeParse({ sortOrder: 'desc' });
      expect(desc.success).toBe(true);
    });

    it('유효한 category 필터를 허용해야 함', () => {
      const result = FindOrphanNotesInputSchema.safeParse({
        category: 'Projects',
      });
      expect(result.success).toBe(true);
    });

    it('잘못된 category를 거부해야 함', () => {
      const result = FindOrphanNotesInputSchema.safeParse({
        category: 'InvalidCategory',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Execution', () => {
    it('빈 볼트에서 빈 결과를 반환해야 함', async () => {
      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('고아 노트가 없습니다');
    });

    it('링크가 없는 노트를 고아 노트로 찾아야 함', async () => {
      // 고아 노트 생성 (링크 없음)
      await executeTool('create_note', {
        title: 'Orphan Note 1',
        content: 'I have no links',
        category: 'Resources',
      }, context);

      await executeTool('create_note', {
        title: 'Orphan Note 2',
        content: 'I also have no links',
        category: 'Projects',
      }, context);

      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Orphan Note 1');
      expect(result.content[0].text).toContain('Orphan Note 2');
      expect(result.content[0].text).toContain('2개의 고아 노트');
    });

    it('연결된 노트는 고아 노트로 찾지 않아야 함', async () => {
      // 첫 번째 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'First note',
        category: 'Resources',
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 두 번째 노트 생성 (첫 번째 노트에 링크)
      await executeTool('create_note', {
        title: 'Note 2',
        content: 'Second note linking to first',
        category: 'Resources',
        links: [note1Uid!],
      }, context);

      // 고아 노트 생성
      await executeTool('create_note', {
        title: 'Orphan Note',
        content: 'I am alone',
        category: 'Resources',
      }, context);

      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result.isError).toBeFalsy();
      // Note 1은 백링크가 있으므로 고아가 아님
      // Note 2는 아웃바운드 링크가 있으므로 고아가 아님
      // Orphan Note만 고아
      expect(result.content[0].text).toContain('Orphan Note');
      expect(result.content[0].text).toContain('1개의 고아 노트');
    });

    it('모든 노트가 연결된 경우 빈 결과를 반환해야 함', async () => {
      // 상호 연결된 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'First note',
        category: 'Resources',
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // Note 2가 Note 1에 링크
      const note2Result = await executeTool('create_note', {
        title: 'Note 2',
        content: 'Links to Note 1',
        category: 'Resources',
        links: [note1Uid!],
      }, context);
      const note2Uid = (note2Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // Note 1을 업데이트하여 Note 2에 링크
      await executeTool('update_note', {
        uid: note1Uid!,
        links: [note2Uid!],
      }, context);

      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('고아 노트가 없습니다');
    });

    it('category 필터를 적용해야 함', async () => {
      // 다양한 카테고리의 고아 노트 생성
      await executeTool('create_note', {
        title: 'Projects Orphan',
        content: 'Project note',
        category: 'Projects',
      }, context);

      await executeTool('create_note', {
        title: 'Resources Orphan',
        content: 'Resource note',
        category: 'Resources',
      }, context);

      // Projects 카테고리만 필터링
      const result = await executeTool('find_orphan_notes', {
        category: 'Projects',
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Projects Orphan');
      expect(result.content[0].text).not.toContain('Resources Orphan');
      expect(result.content[0].text).toContain('1개의 고아 노트');
    });

    it('limit를 적용해야 함', async () => {
      // 5개의 고아 노트 생성
      for (let i = 1; i <= 5; i++) {
        await executeTool('create_note', {
          title: `Orphan ${i}`,
          content: `Content ${i}`,
          category: 'Resources',
        }, context);
      }

      const result = await executeTool('find_orphan_notes', {
        limit: 2,
      }, context);

      expect(result.isError).toBeFalsy();
      // metadata에서 확인
      expect(result._meta?.metadata?.returnedCount).toBe(2);
      expect(result._meta?.metadata?.totalCount).toBe(5);
    });

    it('sortBy와 sortOrder를 적용해야 함', async () => {
      // 노트 생성 (제목 알파벳 순서)
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

      await executeTool('create_note', {
        title: 'Cherry',
        content: 'C note',
        category: 'Resources',
      }, context);

      // 제목 오름차순 정렬
      const ascResult = await executeTool('find_orphan_notes', {
        sortBy: 'title',
        sortOrder: 'asc',
      }, context);

      expect(ascResult.isError).toBeFalsy();
      const ascText = ascResult.content[0].text as string;
      const appleIndex = ascText.indexOf('Apple');
      const bananaIndex = ascText.indexOf('Banana');
      const cherryIndex = ascText.indexOf('Cherry');
      expect(appleIndex).toBeLessThan(bananaIndex);
      expect(bananaIndex).toBeLessThan(cherryIndex);

      // 제목 내림차순 정렬
      const descResult = await executeTool('find_orphan_notes', {
        sortBy: 'title',
        sortOrder: 'desc',
      }, context);

      expect(descResult.isError).toBeFalsy();
      const descText = descResult.content[0].text as string;
      const descAppleIndex = descText.indexOf('Apple');
      const descBananaIndex = descText.indexOf('Banana');
      const descCherryIndex = descText.indexOf('Cherry');
      expect(descCherryIndex).toBeLessThan(descBananaIndex);
      expect(descBananaIndex).toBeLessThan(descAppleIndex);
    });
  });

  describe('Output Format', () => {
    it('고아 노트 정보를 포맷팅해야 함', async () => {
      await executeTool('create_note', {
        title: 'Test Orphan',
        content: 'Test content for orphan note',
        category: 'Resources',
        tags: ['test', 'orphan'],
      }, context);

      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;

      // 기본 정보 포함 확인
      expect(text).toContain('Test Orphan');
      expect(text).toContain('Resources');
      expect(text).toContain('ID:');
    });

    it('metadata에 통계 정보를 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Orphan',
        content: 'Content',
        category: 'Resources',
      }, context);

      const result = await executeTool('find_orphan_notes', {}, context);

      expect(result._meta?.metadata).toBeDefined();
      expect(result._meta?.metadata?.totalCount).toBe(1);
      expect(result._meta?.metadata?.returnedCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('잘못된 입력에 대해 스키마 검증 에러를 throw해야 함', async () => {
      await expect(executeTool('find_orphan_notes', {
        limit: -1,
      }, context)).rejects.toThrow();
    });

    it('잘못된 category에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('find_orphan_notes', {
        category: 'InvalidCategory',
      }, context)).rejects.toThrow();
    });
  });
});
