/**
 * archive_notes tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { ArchiveNotesInputSchema } from '../../../src/tools/schemas.js';

describe('archive_notes tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('uids가 필수여야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('uids가 빈 배열이면 실패해야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({
        uids: [],
      });
      expect(result.success).toBe(false);
    });

    it('dryRun이 false이고 confirm이 없으면 실패해야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({
        uids: ['test-uid'],
        dryRun: false,
      });
      expect(result.success).toBe(false);
    });

    it('dryRun이 true일 때 confirm이 필요 없어야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({
        uids: ['test-uid'],
        dryRun: true,
      });
      expect(result.success).toBe(true);
    });

    it('dryRun이 false이고 confirm이 true일 때 성공해야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({
        uids: ['test-uid'],
        dryRun: false,
        confirm: true,
      });
      expect(result.success).toBe(true);
    });

    it('reason 필드를 허용해야 함', () => {
      const result = ArchiveNotesInputSchema.safeParse({
        uids: ['test-uid'],
        dryRun: true,
        reason: 'Project completed',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution - Dry Run', () => {
    it('dryRun 모드에서 미리보기를 반환해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('미리보기');
      expect(result.content[0].text).toContain('Test Note');
      expect(result._meta?.metadata?.dryRun).toBe(true);
    });

    it('dryRun 모드에서 실제로 노트를 변경하지 않아야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      // 노트가 여전히 Projects 카테고리에 있어야 함
      const readResult = await executeTool('read_note', {
        uid: uid!,
      }, context);

      expect(readResult.content[0].text).toContain('Projects');
      expect(readResult.content[0].text).not.toContain('Archives');
    });

    it('존재하지 않는 UID를 not_found로 표시해야 함', async () => {
      const result = await executeTool('archive_notes', {
        uids: ['non-existent-uid'],
        dryRun: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.notFound).toBe(1);
      expect(result._meta?.metadata?.success).toBe(0);
    });

    it('이미 Archives인 노트를 skipped로 표시해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Already Archived',
        content: 'Content',
        category: 'Archives',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.skipped).toBe(1);
      expect(result._meta?.metadata?.success).toBe(0);
    });
  });

  describe('Tool Execution - Actual Archive', () => {
    it('노트를 Archives로 이동해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'To Archive',
        content: 'Content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: false,
        confirm: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.success).toBe(1);

      // 노트가 Archives로 이동되었는지 확인
      const readResult = await executeTool('read_note', {
        uid: uid!,
      }, context);

      expect(readResult.content[0].text).toContain('Archives');
    });

    it('여러 노트를 한 번에 아카이브해야 함', async () => {
      const uids: string[] = [];

      for (let i = 0; i < 3; i++) {
        const noteResult = await executeTool('create_note', {
          title: `Note ${i}`,
          content: `Content ${i}`,
          category: 'Projects',
        }, context);
        const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];
        uids.push(uid!);
      }

      const result = await executeTool('archive_notes', {
        uids,
        dryRun: false,
        confirm: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.success).toBe(3);
      expect(result._meta?.metadata?.total).toBe(3);
    });

    it('reason을 메타데이터에 포함해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Test Note',
        content: 'Content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: false,
        confirm: true,
        reason: 'Project completed successfully',
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.reason).toBe('Project completed successfully');
    });

    it('혼합 결과를 처리해야 함 (성공, 건너뜀, 찾을 수 없음)', async () => {
      // 성공할 노트
      const note1Result = await executeTool('create_note', {
        title: 'To Archive',
        content: 'Content',
        category: 'Projects',
      }, context);
      const uid1 = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 건너뛸 노트 (이미 Archives)
      const note2Result = await executeTool('create_note', {
        title: 'Already Archived',
        content: 'Content',
        category: 'Archives',
      }, context);
      const uid2 = (note2Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid1!, uid2!, 'non-existent'],
        dryRun: false,
        confirm: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.success).toBe(1);
      expect(result._meta?.metadata?.skipped).toBe(1);
      expect(result._meta?.metadata?.notFound).toBe(1);
      expect(result._meta?.metadata?.total).toBe(3);
    });
  });

  describe('Output Format', () => {
    it('결과 요약을 표시해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Test Note',
        content: 'Content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;
      expect(text).toContain('총 요청');
      expect(text).toContain('Test Note');
    });

    it('각 노트의 상태를 표시해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Note to Archive',
        content: 'Content',
        category: 'Resources',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;
      expect(text).toContain('UID:');
      expect(text).toContain('이전 카테고리:');
      expect(text).toContain('상태:');
    });

    it('메타데이터에 상세 결과를 포함해야 함', async () => {
      const noteResult = await executeTool('create_note', {
        title: 'Test',
        content: 'Content',
        category: 'Projects',
      }, context);
      const uid = (noteResult.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const result = await executeTool('archive_notes', {
        uids: [uid!],
        dryRun: true,
      }, context);

      expect(result._meta?.metadata?.results).toBeDefined();
      expect(Array.isArray(result._meta?.metadata?.results)).toBe(true);
      expect(result._meta?.metadata?.results[0].uid).toBe(uid);
      expect(result._meta?.metadata?.results[0].status).toBe('success');
    });
  });

  describe('Error Handling', () => {
    it('confirm 없이 실제 아카이브를 시도하면 에러를 throw해야 함', async () => {
      await expect(executeTool('archive_notes', {
        uids: ['test-uid'],
        dryRun: false,
        // confirm 없음
      }, context)).rejects.toThrow();
    });

    it('빈 uids 배열에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('archive_notes', {
        uids: [],
        dryRun: true,
      }, context)).rejects.toThrow();
    });
  });
});
