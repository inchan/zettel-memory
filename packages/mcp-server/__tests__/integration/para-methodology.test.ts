/**
 * PARA 방법론 통합 테스트
 * Projects, Areas, Resources, Archives 카테고리 검증
 */

import { executeTool } from '../../src/tools';
import { createTestContext, cleanupTestContext } from '../test-helpers';
import type { ToolExecutionContext } from '../../src/tools/types';

describe('PARA Methodology Integration Tests', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('Projects 카테고리', () => {
    it('프로젝트 노트를 생성하고 프로젝트별로 필터링할 수 있다', async () => {
      // 프로젝트 관련 노트 생성
      await executeTool(
        'create_note',
        {
          title: '웹사이트 리디자인 계획',
          content: '## 목표\n- 현대적인 UI/UX\n- 성능 개선\n\n## 마감일\n2025-12-31',
          category: 'Projects',
          project: 'website-redesign',
          tags: ['planning', 'ui', 'performance'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: 'DB 스키마 설계',
          content: '웹사이트 리디자인을 위한 데이터베이스 스키마',
          category: 'Projects',
          project: 'website-redesign',
          tags: ['database', 'schema'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: 'API 마이그레이션',
          content: '별도 프로젝트',
          category: 'Projects',
          project: 'api-migration',
          tags: ['api'],
        },
        context
      );

      // 프로젝트별 필터링
      const redesignNotes = await executeTool(
        'list_notes',
        { project: 'website-redesign' },
        context
      );

      const text = redesignNotes.content[0]?.text || '';
      expect(text).toContain('웹사이트 리디자인 계획');
      expect(text).toContain('DB 스키마 설계');
      expect(text).not.toContain('API 마이그레이션');

      // 메타데이터 확인
      const metadata = redesignNotes._meta?.metadata as any;
      expect(metadata?.total).toBe(2);
    });

    it('프로젝트 완료 시 Archives로 이동할 수 있다', async () => {
      // 프로젝트 노트 생성
      const projectNote = await executeTool(
        'create_note',
        {
          title: '완료된 프로젝트',
          content: '프로젝트 내용',
          category: 'Projects',
          project: 'completed-project',
          tags: ['active'],
        },
        context
      );
      const uid = projectNote._meta?.metadata?.id;

      // Projects 카테고리에 있는지 확인
      const activeProjects = await executeTool(
        'list_notes',
        { category: 'Projects' },
        context
      );
      expect(activeProjects.content[0]?.text).toContain('완료된 프로젝트');

      // Archives로 이동
      await executeTool(
        'update_note',
        {
          uid,
          category: 'Archives',
          tags: ['active', 'completed'],
        },
        context
      );

      // Projects에서 사라짐
      const updatedProjects = await executeTool(
        'list_notes',
        { category: 'Projects' },
        context
      );
      expect(updatedProjects.content[0]?.text || '').not.toContain(
        '완료된 프로젝트'
      );

      // Archives에 나타남
      const archives = await executeTool(
        'list_notes',
        { category: 'Archives' },
        context
      );
      expect(archives.content[0]?.text).toContain('완료된 프로젝트');
    });
  });

  describe('Areas 카테고리', () => {
    it('지속적인 책임 영역을 관리할 수 있다', async () => {
      // 여러 Areas 노트 생성
      await executeTool(
        'create_note',
        {
          title: '건강 관리 루틴',
          content: '## 일일 습관\n- 운동 30분\n- 물 8잔\n- 7시간 수면',
          category: 'Areas',
          tags: ['health', 'routine', 'habits'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '재정 관리 원칙',
          content: '## 월별 예산\n- 저축: 30%\n- 필수: 50%\n- 여가: 20%',
          category: 'Areas',
          tags: ['finance', 'budget'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '팀 리더십',
          content: '## 핵심 책임\n- 1:1 미팅\n- 코드 리뷰\n- 멘토링',
          category: 'Areas',
          tags: ['leadership', 'team'],
        },
        context
      );

      // Areas 카테고리 전체 조회
      const areas = await executeTool(
        'list_notes',
        { category: 'Areas' },
        context
      );

      const text = areas.content[0]?.text || '';
      expect(text).toContain('건강 관리 루틴');
      expect(text).toContain('재정 관리 원칙');
      expect(text).toContain('팀 리더십');

      const metadata = areas._meta?.metadata as any;
      expect(metadata?.total).toBe(3);
    });

    it('특정 영역의 노트를 태그로 검색할 수 있다', async () => {
      await executeTool(
        'create_note',
        {
          title: '건강 체크리스트',
          content: '건강 관련 내용',
          category: 'Areas',
          tags: ['health'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '재정 보고서',
          content: '재정 관련 내용',
          category: 'Areas',
          tags: ['finance'],
        },
        context
      );

      // 태그로 필터링
      const healthNotes = await executeTool(
        'list_notes',
        { category: 'Areas', tags: ['health'] },
        context
      );

      expect(healthNotes.content[0]?.text).toContain('건강 체크리스트');
      expect(healthNotes.content[0]?.text || '').not.toContain('재정 보고서');
    });
  });

  describe('Resources 카테고리', () => {
    it('참고 자료를 저장하고 재사용할 수 있다', async () => {
      // 리소스 노트 생성
      const resource1 = await executeTool(
        'create_note',
        {
          title: 'TypeScript 타입 가드 패턴',
          content:
            '```typescript\nfunction isString(value: unknown): value is string {\n  return typeof value === "string";\n}\n```',
          category: 'Resources',
          tags: ['typescript', 'patterns', 'type-guards'],
        },
        context
      );

      const resource2 = await executeTool(
        'create_note',
        {
          title: 'REST API 상태 코드',
          content:
            '- 200: OK\n- 201: Created\n- 400: Bad Request\n- 404: Not Found\n- 500: Server Error',
          category: 'Resources',
          tags: ['api', 'http', 'reference'],
        },
        context
      );

      // 프로젝트에서 리소스 참조
      const projectNote = await executeTool(
        'create_note',
        {
          title: 'API 개발 작업',
          content: 'REST API 상태 코드를 참조하여 구현',
          category: 'Projects',
          project: 'api-dev',
          links: [resource2._meta?.metadata?.id],
        },
        context
      );

      // 리소스 검색
      const searchResult = await executeTool(
        'search_memory',
        { query: 'TypeScript', category: 'Resources' },
        context
      );

      expect(searchResult.content[0]?.text).toContain('TypeScript');
    });

    it('여러 프로젝트에서 동일 리소스를 참조할 수 있다', async () => {
      // 공통 리소스
      const designSystem = await executeTool(
        'create_note',
        {
          title: '회사 디자인 시스템 가이드',
          content: '## 색상\n- Primary: #0066CC\n## 타이포그래피\n- Heading: Inter',
          category: 'Resources',
          tags: ['design-system', 'ui'],
        },
        context
      );
      const resourceUid = designSystem._meta?.metadata?.id;

      // 여러 프로젝트에서 참조
      await executeTool(
        'create_note',
        {
          title: '마케팅 랜딩 페이지',
          content: '디자인 시스템 가이드에 따라 구현',
          category: 'Projects',
          project: 'marketing-landing',
          links: [resourceUid],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '고객 포털 리뉴얼',
          content: '브랜드 가이드라인 준수',
          category: 'Projects',
          project: 'customer-portal',
          links: [resourceUid],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '모바일 앱 UI 개선',
          content: '일관된 디자인 시스템 적용',
          category: 'Projects',
          project: 'mobile-ui',
          links: [resourceUid],
        },
        context
      );

      // 리소스 노트 확인
      const resourceWithLinks = await executeTool(
        'read_note',
        { uid: resourceUid },
        context
      );

      const text = resourceWithLinks.content[0]?.text || '';
      expect(text).toContain('디자인 시스템');

      // 프로젝트들이 리소스를 참조하고 있는지 확인 (front matter links 배열)
      // 실제 백링크 그래프는 인덱싱 시점에 구축됨
      const projectNotesResult = await executeTool(
        'list_notes',
        { category: 'Projects' },
        context
      );
      // 모든 프로젝트가 생성되었는지 확인
      expect(projectNotesResult._meta?.metadata as any).toHaveProperty('total', 3);
    });
  });

  describe('Archives 카테고리', () => {
    it('완료되거나 비활성화된 항목을 보관할 수 있다', async () => {
      // 보관 노트들 생성
      await executeTool(
        'create_note',
        {
          title: '2024 Q4 마케팅 캠페인',
          content: '## 완료됨\n- ROI: 150%\n- 신규 고객: 500명',
          category: 'Archives',
          tags: ['completed', 'marketing', '2024'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '이전 팀 프로세스',
          content: '더 이상 사용하지 않는 프로세스',
          category: 'Archives',
          tags: ['legacy', 'process'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: 'React Class Components (구버전)',
          content: 'Hooks 이전 방식',
          category: 'Archives',
          tags: ['react', 'legacy'],
        },
        context
      );

      // Archives 조회
      const archives = await executeTool(
        'list_notes',
        { category: 'Archives' },
        context
      );

      const metadata = archives._meta?.metadata as any;
      expect(metadata?.total).toBe(3);

      // 연도별 태그 필터링 (검색 인덱스가 없으므로 태그로 확인)
      const archives2024 = await executeTool(
        'list_notes',
        { category: 'Archives', tags: ['2024'] },
        context
      );

      expect(archives2024.content[0]?.text).toContain('마케팅 캠페인');
    });
  });

  describe('PARA 카테고리 간 워크플로우', () => {
    it('영역에서 프로젝트로 전환할 수 있다', async () => {
      // 1. 영역 정의
      const learningArea = await executeTool(
        'create_note',
        {
          title: '기술 학습',
          content: '## 학습 분야\n- 클라우드 컴퓨팅\n- 머신러닝\n- DevOps',
          category: 'Areas',
          tags: ['learning', 'technology'],
        },
        context
      );
      const areaUid = learningArea._meta?.metadata?.id;

      // 2. 영역에서 구체적인 프로젝트 생성
      const certProject = await executeTool(
        'create_note',
        {
          title: 'AWS Solutions Architect 자격증 취득',
          content:
            '## 목표\n자격증 취득 by 2025-06-30\n\n## 참조\n기술 학습 영역에서 파생',
          category: 'Projects',
          project: 'aws-certification',
          tags: ['aws', 'certification', 'learning'],
          links: [areaUid],
        },
        context
      );
      const projectUid = certProject._meta?.metadata?.id;

      // 3. 영역 노트 업데이트
      await executeTool(
        'update_note',
        {
          uid: areaUid,
          content:
            '## 학습 분야\n- 클라우드 컴퓨팅\n- 머신러닝\n- DevOps\n\n## 현재 프로젝트\n- AWS 자격증 취득',
          links: [projectUid],
        },
        context
      );

      // 4. 업데이트된 영역 노트 확인
      const areaWithLinks = await executeTool(
        'read_note',
        { uid: areaUid },
        context
      );

      const areaText = areaWithLinks.content[0]?.text || '';
      expect(areaText).toContain('기술 학습');
      expect(areaText).toContain('현재 프로젝트');

      // Front matter에 links 배열이 업데이트되었는지 확인
      const areaMetadata = areaWithLinks._meta?.metadata as any;
      expect(areaMetadata?.links).toContain(projectUid);
    });

    it('모든 PARA 카테고리를 동시에 사용할 수 있다', async () => {
      // 각 카테고리에 하나씩 생성
      await executeTool(
        'create_note',
        {
          title: '현재 진행 중인 프로젝트',
          content: '프로젝트 내용',
          category: 'Projects',
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '지속적인 책임 영역',
          content: '영역 내용',
          category: 'Areas',
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '참고 자료',
          content: '리소스 내용',
          category: 'Resources',
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '보관된 항목',
          content: '보관 내용',
          category: 'Archives',
        },
        context
      );

      // 전체 노트 수 확인
      const allNotes = await executeTool('list_notes', {}, context);
      const metadata = allNotes._meta?.metadata as any;
      expect(metadata?.total).toBe(4);

      // 각 카테고리별로 1개씩
      for (const category of ['Projects', 'Areas', 'Resources', 'Archives']) {
        const categoryNotes = await executeTool(
          'list_notes',
          { category },
          context
        );
        expect(categoryNotes._meta?.metadata?.total).toBe(1);
      }
    });
  });

  describe('PARA 방법론 실용 시나리오', () => {
    it('프로젝트 생명주기 전체를 관리할 수 있다', async () => {
      // 1. 프로젝트 시작
      const projectHub = await executeTool(
        'create_note',
        {
          title: '사용자 대시보드 기능 개발',
          content: '## 요구사항\n- 실시간 통계\n- 커스텀 위젯\n- 데이터 내보내기',
          category: 'Projects',
          project: 'user-dashboard',
          tags: ['feature', 'dashboard', 'in-progress'],
        },
        context
      );
      const hubUid = projectHub._meta?.metadata?.id;

      // 2. 작업 노트들 생성
      const taskNote1 = await executeTool(
        'create_note',
        {
          title: '대시보드 DB 스키마',
          content:
            '## Tables\n- user_widgets\n- dashboard_layouts\n- widget_data',
          category: 'Projects',
          project: 'user-dashboard',
          tags: ['database'],
          links: [hubUid],
        },
        context
      );

      const taskNote2 = await executeTool(
        'create_note',
        {
          title: '대시보드 API 엔드포인트',
          content: '## Endpoints\n- GET /dashboard\n- POST /widgets',
          category: 'Projects',
          project: 'user-dashboard',
          tags: ['api'],
          links: [hubUid],
        },
        context
      );

      // 3. 프로젝트 노트 조회
      const dashboardNotes = await executeTool(
        'list_notes',
        { project: 'user-dashboard' },
        context
      );
      expect(dashboardNotes._meta?.metadata?.total).toBe(3);

      // 4. 프로젝트 완료 처리
      const allDashboardNotes = [hubUid, taskNote1._meta?.metadata?.id, taskNote2._meta?.metadata?.id];

      for (const uid of allDashboardNotes) {
        const readResult = await executeTool('read_note', { uid }, context);
        const currentTags = readResult._meta?.metadata?.tags || [];

        await executeTool(
          'update_note',
          {
            uid,
            category: 'Archives',
            tags: [...currentTags, 'completed'],
          },
          context
        );
      }

      // 5. Projects에서 사라짐
      const activeProjects = await executeTool(
        'list_notes',
        { category: 'Projects', project: 'user-dashboard' },
        context
      );
      expect(activeProjects._meta?.metadata?.total).toBe(0);

      // 6. Archives에 나타남
      const archivedNotes = await executeTool(
        'list_notes',
        { category: 'Archives', project: 'user-dashboard' },
        context
      );
      expect(archivedNotes._meta?.metadata?.total).toBe(3);
    });
  });
});
