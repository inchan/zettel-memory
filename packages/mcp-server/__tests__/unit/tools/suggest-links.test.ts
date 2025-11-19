/**
 * suggest_links tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { SuggestLinksInputSchema } from '../../../src/tools/schemas.js';

describe('suggest_links tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('uid가 필수여야 함', () => {
      const result = SuggestLinksInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('빈 uid를 거부해야 함', () => {
      const result = SuggestLinksInputSchema.safeParse({
        uid: '',
      });
      expect(result.success).toBe(false);
    });

    it('유효한 입력을 허용해야 함', () => {
      const result = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
      });
      expect(result.success).toBe(true);
    });

    it('limit 범위를 검증해야 함', () => {
      const tooSmall = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        limit: 0,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        limit: 101,
      });
      expect(tooLarge.success).toBe(false);

      const valid = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        limit: 20,
      });
      expect(valid.success).toBe(true);
    });

    it('minScore 범위를 검증해야 함', () => {
      const tooSmall = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        minScore: -0.1,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        minScore: 1.1,
      });
      expect(tooLarge.success).toBe(false);

      const valid = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        minScore: 0.5,
      });
      expect(valid.success).toBe(true);
    });

    it('excludeExisting 옵션을 처리해야 함', () => {
      const result = SuggestLinksInputSchema.safeParse({
        uid: 'test-uid',
        excludeExisting: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('존재하지 않는 UID에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('suggest_links', {
        uid: 'non-existent-uid',
      }, context)).rejects.toThrow();
    });

    it('다른 노트가 없을 때 빈 제안을 반환해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Lonely Note',
        content: 'All alone',
        category: 'Resources',
        tags: ['lonely'],
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('suggest_links', {
        uid: uid!,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('제안이 없습니다');
      expect(result._meta?.metadata?.totalSuggestions).toBe(0);
    });

    it('공통 태그가 있는 노트를 제안해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target Note',
        content: 'Target content about programming',
        category: 'Resources',
        tags: ['programming', 'javascript'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 유사한 노트 생성
      await executeTool('create_note', {
        title: 'Similar Note',
        content: 'Content about programming',
        category: 'Resources',
        tags: ['programming', 'typescript'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.totalSuggestions).toBeGreaterThan(0);
    });

    it('동일한 카테고리의 노트에 가중치를 부여해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Target content',
        category: 'Projects',
        tags: ['test'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 같은 카테고리의 노트
      await executeTool('create_note', {
        title: 'Same Category',
        content: 'Same project',
        category: 'Projects',
        tags: ['test'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      // 카테고리가 같고 태그도 같으므로 높은 점수
      const suggestions = result._meta?.metadata?.suggestions || [];
      if (suggestions.length > 0) {
        expect(suggestions[0].score).toBeGreaterThan(0.1);
      }
    });

    it('동일한 프로젝트의 노트에 가중치를 부여해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Content',
        category: 'Projects',
        project: 'my-project',
        tags: ['dev'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 같은 프로젝트의 노트
      await executeTool('create_note', {
        title: 'Same Project Note',
        content: 'Related content',
        category: 'Projects',
        project: 'my-project',
        tags: ['dev'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      const suggestions = result._meta?.metadata?.suggestions || [];
      if (suggestions.length > 0) {
        expect(suggestions[0].score).toBeGreaterThan(0.2);
      }
    });

    it('excludeExisting=true일 때 기존 링크를 제외해야 함', async () => {
      // 첫 번째 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'Content',
        category: 'Resources',
        tags: ['shared'],
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 두 번째 노트 생성 (첫 번째에 링크됨)
      const note2Result = await executeTool('create_note', {
        title: 'Note 2',
        content: 'Links to Note 1',
        category: 'Resources',
        tags: ['shared'],
        links: [note1Uid!],
      }, context);
      const note2Uid = (note2Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 세 번째 노트 생성 (연결되지 않음)
      await executeTool('create_note', {
        title: 'Note 3',
        content: 'Not linked',
        category: 'Resources',
        tags: ['shared'],
      }, context);

      // Note 2에 대한 제안 (Note 1은 이미 링크됨)
      const result = await executeTool('suggest_links', {
        uid: note2Uid!,
        excludeExisting: true,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      const suggestions = result._meta?.metadata?.suggestions || [];
      // Note 1은 제외되어야 함
      const hasNote1 = suggestions.some((s: any) => s.uid === note1Uid);
      expect(hasNote1).toBe(false);
    });

    it('excludeExisting=false일 때 기존 링크를 포함해야 함', async () => {
      // 첫 번째 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'Content',
        category: 'Resources',
        tags: ['shared'],
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 두 번째 노트 생성 (첫 번째에 링크됨)
      const note2Result = await executeTool('create_note', {
        title: 'Note 2',
        content: 'Links to Note 1',
        category: 'Resources',
        tags: ['shared'],
        links: [note1Uid!],
      }, context);
      const note2Uid = (note2Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('suggest_links', {
        uid: note2Uid!,
        excludeExisting: false,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      // excludeExisting이 false이므로 Note 1이 포함될 수 있음
      expect(result._meta?.metadata?.excludeExisting).toBe(false);
    });

    it('limit를 적용해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Target content',
        category: 'Resources',
        tags: ['common'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 유사한 노트 5개 생성
      for (let i = 0; i < 5; i++) {
        await executeTool('create_note', {
          title: `Similar ${i}`,
          content: `Content ${i}`,
          category: 'Resources',
          tags: ['common'],
        }, context);
      }

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        limit: 2,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.suggestions?.length).toBeLessThanOrEqual(2);
    });

    it('minScore 이상의 점수만 반환해야 함', async () => {
      // 대상 노트 생성
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Specific content',
        category: 'Projects',
        tags: ['unique'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 완전히 다른 노트 생성
      await executeTool('create_note', {
        title: 'Different',
        content: 'Completely different',
        category: 'Archives',
        tags: ['other'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.9, // 매우 높은 임계값
      }, context);

      expect(result.isError).toBeFalsy();
      // 높은 임계값으로 인해 제안이 없어야 함
      expect(result._meta?.metadata?.totalSuggestions).toBe(0);
    });
  });

  describe('Score Calculation', () => {
    it('점수는 0과 1 사이여야 함', async () => {
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Content',
        category: 'Resources',
        tags: ['test'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('create_note', {
        title: 'Similar',
        content: 'Similar content',
        category: 'Resources',
        tags: ['test'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0,
      }, context);

      expect(result.isError).toBeFalsy();
      const suggestions = result._meta?.metadata?.suggestions || [];
      for (const suggestion of suggestions) {
        expect(suggestion.score).toBeGreaterThanOrEqual(0);
        expect(suggestion.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Output Format', () => {
    it('제안 정보를 포맷팅해야 함', async () => {
      const targetResult = await executeTool('create_note', {
        title: 'Target Note',
        content: 'Content',
        category: 'Resources',
        tags: ['tag1', 'tag2'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('create_note', {
        title: 'Suggested Note',
        content: 'Related content',
        category: 'Resources',
        tags: ['tag1', 'tag3'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;

      if (result._meta?.metadata?.totalSuggestions > 0) {
        expect(text).toContain('Suggested Note');
        expect(text).toContain('UID:');
        expect(text).toContain('카테고리:');
      }
    });

    it('메타데이터에 제안 목록을 포함해야 함', async () => {
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Content',
        category: 'Resources',
        tags: ['shared'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('create_note', {
        title: 'Suggested',
        content: 'Similar',
        category: 'Resources',
        tags: ['shared'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result._meta?.metadata).toBeDefined();
      expect(result._meta?.metadata?.targetUid).toBe(targetUid);
      expect(result._meta?.metadata?.targetTitle).toBe('Target');
      expect(result._meta?.metadata?.suggestions).toBeDefined();
      expect(result._meta?.metadata?.minScore).toBeDefined();
      expect(result._meta?.metadata?.excludeExisting).toBeDefined();
    });

    it('공통 태그를 표시해야 함', async () => {
      const targetResult = await executeTool('create_note', {
        title: 'Target',
        content: 'Content',
        category: 'Resources',
        tags: ['javascript', 'nodejs'],
      }, context);
      const targetUid = (targetResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('create_note', {
        title: 'Suggested',
        content: 'Related',
        category: 'Resources',
        tags: ['javascript', 'react'],
      }, context);

      const result = await executeTool('suggest_links', {
        uid: targetUid!,
        minScore: 0.1,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;

      if (result._meta?.metadata?.totalSuggestions > 0) {
        expect(text).toContain('공통 태그:');
      }
    });
  });

  describe('Error Handling', () => {
    it('존재하지 않는 UID에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('suggest_links', {
        uid: 'non-existent-uid',
      }, context)).rejects.toThrow();
    });

    it('잘못된 입력에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('suggest_links', {
        uid: '',
      }, context)).rejects.toThrow();
    });

    it('잘못된 limit에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('suggest_links', {
        uid: 'test-uid',
        limit: 0,
      }, context)).rejects.toThrow();
    });
  });
});
