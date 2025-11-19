/**
 * get_organization_health tool tests
 */

import { executeTool } from '../../../src/tools/registry.js';
import { createTestContext, cleanupTestContext } from '../../test-helpers.js';
import type { ToolExecutionContext } from '../../../src/tools/types.js';
import { GetOrganizationHealthInputSchema } from '../../../src/tools/schemas.js';

describe('get_organization_health tool', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Schema Validation', () => {
    it('빈 입력을 허용해야 함', () => {
      const result = GetOrganizationHealthInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('includeDetails 옵션을 처리해야 함', () => {
      const result = GetOrganizationHealthInputSchema.safeParse({
        includeDetails: false,
      });
      expect(result.success).toBe(true);
    });

    it('includeRecommendations 옵션을 처리해야 함', () => {
      const result = GetOrganizationHealthInputSchema.safeParse({
        includeRecommendations: false,
      });
      expect(result.success).toBe(true);
    });

    it('모든 옵션을 조합하여 사용할 수 있어야 함', () => {
      const result = GetOrganizationHealthInputSchema.safeParse({
        includeDetails: true,
        includeRecommendations: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('빈 볼트에서 건강 상태를 반환해야 함', async () => {
      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('볼트가 비어 있습니다');
      expect(result._meta?.metadata?.totalNotes).toBe(0);
      expect(result._meta?.metadata?.healthScore).toBe(100);
    });

    it('노트가 있는 볼트에서 건강 점수를 계산해야 함', async () => {
      // 노트 생성
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.totalNotes).toBe(1);
      expect(result._meta?.metadata?.healthScore).toBeDefined();
      expect(result._meta?.metadata?.healthGrade).toBeDefined();
    });

    it('고아 노트 비율을 계산해야 함', async () => {
      // 고아 노트 2개 생성
      await executeTool('create_note', {
        title: 'Orphan 1',
        content: 'No links',
        category: 'Resources',
      }, context);

      await executeTool('create_note', {
        title: 'Orphan 2',
        content: 'No links either',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.orphanCount).toBe(2);
      expect(result._meta?.metadata?.orphanRatio).toBe(100); // 100%
    });

    it('연결된 노트가 있으면 고아 노트 비율이 낮아야 함', async () => {
      // 첫 번째 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'First note',
        category: 'Resources',
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      // 두 번째 노트 (첫 번째에 링크)
      await executeTool('create_note', {
        title: 'Note 2',
        content: 'Links to note 1',
        category: 'Resources',
        links: [note1Uid!],
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.orphanCount).toBe(0);
      expect(result._meta?.metadata?.orphanRatio).toBe(0);
    });

    it('카테고리 통계를 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Project Note',
        content: 'Project content',
        category: 'Projects',
      }, context);

      await executeTool('create_note', {
        title: 'Resource Note',
        content: 'Resource content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {
        includeDetails: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.categoryStats).toBeDefined();
      expect(result._meta?.metadata?.categoryStats?.Projects).toBe(1);
      expect(result._meta?.metadata?.categoryStats?.Resources).toBe(1);
    });

    it('카테고리 균형 점수를 계산해야 함', async () => {
      // 균형 잡힌 카테고리 분포
      await executeTool('create_note', {
        title: 'Project',
        content: 'Content',
        category: 'Projects',
      }, context);

      await executeTool('create_note', {
        title: 'Resource',
        content: 'Content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.categoryBalanceScore).toBeDefined();
      // 균형 잡힌 분포는 높은 점수를 받아야 함
      expect(result._meta?.metadata?.categoryBalanceScore).toBeGreaterThan(0);
    });

    it('includeDetails=false일 때 카테고리 상세 정보를 제외해야 함', async () => {
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {
        includeDetails: false,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;
      // 상세 정보 섹션이 없어야 함
      expect(text).not.toContain('### 카테고리 분포');
    });

    it('includeRecommendations=true일 때 권장사항을 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Orphan Note',
        content: 'No links',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {
        includeRecommendations: true,
      }, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.recommendations).toBeDefined();
      expect(Array.isArray(result._meta?.metadata?.recommendations)).toBe(true);
    });

    it('includeRecommendations=false일 때 권장사항을 제외해야 함', async () => {
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {
        includeRecommendations: false,
      }, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;
      // 권장사항 섹션이 없어야 함
      expect(text).not.toContain('### 권장사항');
    });

    it('건강 등급을 반환해야 함', async () => {
      // 노트가 있어야 건강 등급이 계산됨
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      expect(result._meta?.metadata?.healthGrade).toBeDefined();
    });
  });

  describe('Health Score Calculation', () => {
    it('잘 조직된 볼트는 높은 점수를 받아야 함', async () => {
      // 연결된 노트 생성
      const note1Result = await executeTool('create_note', {
        title: 'Note 1',
        content: 'First note',
        category: 'Projects',
      }, context);
      const note1Uid = (note1Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      const note2Result = await executeTool('create_note', {
        title: 'Note 2',
        content: 'Second note',
        category: 'Resources',
        links: [note1Uid!],
      }, context);
      const note2Uid = (note2Result.content[0].text as string).match(/\*\*ID\*\*: (\S+)/)?.[1];

      await executeTool('update_note', {
        uid: note1Uid!,
        links: [note2Uid!],
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      // 모두 연결된 노트, 균형 잡힌 카테고리 = 높은 점수
      expect(result._meta?.metadata?.healthScore).toBeGreaterThanOrEqual(60);
    });

    it('많은 고아 노트가 있으면 점수가 낮아야 함', async () => {
      // 고아 노트 여러 개 생성
      for (let i = 0; i < 5; i++) {
        await executeTool('create_note', {
          title: `Orphan ${i}`,
          content: 'No links',
          category: 'Resources',
        }, context);
      }

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      // 많은 고아 노트 = 점수 감점
      expect(result._meta?.metadata?.orphanRatio).toBe(100);
    });
  });

  describe('Output Format', () => {
    it('기본 통계를 표시해야 함', async () => {
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result.isError).toBeFalsy();
      const text = result.content[0].text as string;
      expect(text).toContain('건강 점수');
      expect(text).toContain('총 노트');
      expect(text).toContain('고아 노트');
    });

    it('메타데이터에 모든 통계를 포함해야 함', async () => {
      await executeTool('create_note', {
        title: 'Test Note',
        content: 'Test content',
        category: 'Resources',
      }, context);

      const result = await executeTool('get_organization_health', {}, context);

      expect(result._meta?.metadata).toBeDefined();
      expect(result._meta?.metadata?.healthScore).toBeDefined();
      expect(result._meta?.metadata?.healthGrade).toBeDefined();
      expect(result._meta?.metadata?.totalNotes).toBeDefined();
      expect(result._meta?.metadata?.orphanCount).toBeDefined();
      expect(result._meta?.metadata?.orphanRatio).toBeDefined();
      expect(result._meta?.metadata?.staleCount).toBeDefined();
      expect(result._meta?.metadata?.staleRatio).toBeDefined();
      expect(result._meta?.metadata?.categoryBalanceScore).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('잘못된 타입의 옵션에 대해 에러를 throw해야 함', async () => {
      await expect(executeTool('get_organization_health', {
        includeDetails: 'invalid',
      }, context)).rejects.toThrow();
    });
  });
});
