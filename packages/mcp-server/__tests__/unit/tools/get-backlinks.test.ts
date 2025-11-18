/**
 * get_backlinks tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { GetBacklinksInputSchema } from '../../../src/tools/schemas.js';

describe('get_backlinks tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('유효한 입력을 검증해야 함', () => {
      const result = GetBacklinksInputSchema.safeParse({
        uid: '20251118T030000000Z',
      });
      expect(result.success).toBe(true);
    });

    it('UID가 없으면 실패해야 함', () => {
      const result = GetBacklinksInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('빈 UID를 거부해야 함', () => {
      const result = GetBacklinksInputSchema.safeParse({
        uid: '',
      });
      expect(result.success).toBe(false);
    });

    it('기본 limit를 적용해야 함', () => {
      // Zod optional().default() - default is applied during parse
      const result = GetBacklinksInputSchema.parse({
        uid: 'test-uid',
        limit: 20,
      });
      expect(result.limit).toBe(20);
    });

    it('limit 범위를 검증해야 함', () => {
      const tooSmall = GetBacklinksInputSchema.safeParse({
        uid: 'test',
        limit: 0,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = GetBacklinksInputSchema.safeParse({
        uid: 'test',
        limit: 101,
      });
      expect(tooLarge.success).toBe(false);

      const valid = GetBacklinksInputSchema.safeParse({
        uid: 'test',
        limit: 50,
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('백링크가 없는 노트를 처리해야 함', async () => {
      const createResult = await executeTool('create_note', {
        title: 'Lonely Note',
        content: 'No one links to me',
        category: 'Resources',
      }, context);
      const uid = (createResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('get_backlinks', { uid: uid! }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('를 참조하는 노트가 없습니다');
    });

    it('백링크를 찾아야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target Note',
        content: 'This is the target',
        category: 'Resources',
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 링크하는 노트 생성
      await executeTool('create_note', {
        title: 'Linking Note',
        content: 'This links to target',
        category: 'Resources',
        links: [targetUid!],
      }, context);

      const result = await executeTool('get_backlinks', { uid: targetUid! }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Linking Note');
      expect(result.content[0].text).toContain('1개의 노트가 이 노트를 참조합니다');
    });

    it('여러 백링크를 찾아야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Popular Note',
        content: 'Everyone links to me',
        category: 'Resources',
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 여러 노트에서 링크
      for (let i = 1; i <= 3; i++) {
        await executeTool('create_note', {
          title: `Linking Note ${i}`,
          content: `This is note ${i}`,
          category: 'Resources',
          links: [targetUid!],
        }, context);
      }

      const result = await executeTool('get_backlinks', { uid: targetUid! }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('3개의 노트가 이 노트를 참조합니다');
    });

    it('limit를 적용해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Target note',
        category: 'Resources',
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 5개 노트에서 링크
      for (let i = 1; i <= 5; i++) {
        await executeTool('create_note', {
          title: `Note ${i}`,
          content: `Content ${i}`,
          category: 'Resources',
          links: [targetUid!],
        }, context);
      }

      const result = await executeTool('get_backlinks', {
        uid: targetUid!,
        limit: 2,
      }, context);

      expect(result.isError).toBeFalsy();
      // limit가 적용되어 2개만 반환됨
      expect(result.content[0].text).toContain('2개의 노트가 이 노트를 참조합니다');
    });
  });

  describe('Error Handling', () => {
    it('존재하지 않는 UID에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('get_backlinks', {
        uid: 'non-existent-uid',
      }, context)).rejects.toThrow('노트를 찾을 수 없습니다');
    });

    it('잘못된 입력에 대해 스키마 검증 에러를 throw해야 함', async () => {
      await expect(executeTool('get_backlinks', {
        uid: '',
      }, context)).rejects.toThrow();
    });
  });
});
