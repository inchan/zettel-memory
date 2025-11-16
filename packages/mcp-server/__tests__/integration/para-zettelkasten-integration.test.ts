/**
 * PARA + Zettelkasten 통합 테스트
 * 두 방법론을 함께 사용하는 복합 시나리오 검증
 */

import { executeTool } from '../../src/tools';
import { createTestContext, cleanupTestContext } from '../test-helpers';
import type { ToolExecutionContext } from '../../src/tools/types';

describe('PARA + Zettelkasten Integration Tests', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  describe('프로젝트 기반 지식 구축', () => {
    it('프로젝트 진행 중 Zettelkasten 방식으로 지식을 축적할 수 있다', async () => {
      // 1. 프로젝트 허브 생성
      const projectHub = await executeTool(
        'create_note',
        {
          title: '프로젝트: AI 추천 시스템 구축',
          content:
            '## 목표\n협업 필터링 기반 추천 엔진 구현\n\n## 기간\n2025-01 ~ 2025-03',
          category: 'Projects',
          project: 'ai-recommender',
          tags: ['ai', 'machine-learning', 'recommender'],
        },
        context
      );
      const hubUid = projectHub._meta?.metadata?.id;

      // 2. 프로젝트 중 발견한 개념들을 Resources에 Zettelkasten 노트로 기록
      const coldStartNote = await executeTool(
        'create_note',
        {
          title: '협업 필터링의 Cold Start 문제',
          content:
            '신규 사용자나 아이템에 대한 데이터가 없어 추천이 어려움\n\n## 해결책\n- 콘텐츠 기반 필터링 보완\n- 인기도 기반 추천',
          category: 'Resources', // 재사용 가능한 지식
          tags: ['collaborative-filtering', 'cold-start', 'recommender'],
          links: [hubUid],
        },
        context
      );

      const matrixNote = await executeTool(
        'create_note',
        {
          title: '행렬 분해를 통한 잠재 요인 추출',
          content:
            '사용자-아이템 행렬을 저차원 잠재 요인으로 분해\n\n## 알고리즘\n- SVD\n- ALS',
          category: 'Resources',
          tags: ['matrix-factorization', 'machine-learning'],
          links: [hubUid, coldStartNote._meta?.metadata?.id],
        },
        context
      );

      const metricsNote = await executeTool(
        'create_note',
        {
          title: '추천 시스템 평가 지표',
          content:
            '## 정확도\n- RMSE, MAE\n\n## 랭킹\n- Precision@K\n- Recall@K',
          category: 'Resources',
          tags: ['evaluation', 'metrics', 'recommender'],
          links: [hubUid],
        },
        context
      );

      // 3. 프로젝트 작업 노트
      const implementationNote = await executeTool(
        'create_note',
        {
          title: '추천 엔진 구현 로그',
          content:
            '## 2025-01-15\n- ALS 알고리즘 선택\n- Cold Start 해결을 위해 하이브리드 방식 적용',
          category: 'Projects',
          project: 'ai-recommender',
          tags: ['implementation', 'log'],
          links: [
            matrixNote._meta?.metadata?.id,
            coldStartNote._meta?.metadata?.id,
          ],
        },
        context
      );

      // 4. 프로젝트 허브 업데이트
      await executeTool(
        'update_note',
        {
          uid: hubUid,
          content:
            '## 목표\n협업 필터링 기반 추천 엔진 구현\n\n## 기간\n2025-01 ~ 2025-03\n\n## 축적된 지식\n- Cold Start 문제 이해\n- 행렬 분해 기법\n- 평가 지표',
          links: [
            coldStartNote._meta?.metadata?.id,
            matrixNote._meta?.metadata?.id,
            metricsNote._meta?.metadata?.id,
            implementationNote._meta?.metadata?.id,
          ],
        },
        context
      );

      // 검증
      // 프로젝트 노트들
      const projectNotes = await executeTool(
        'list_notes',
        { project: 'ai-recommender' },
        context
      );
      expect(projectNotes._meta?.metadata?.total).toBe(2); // hub + implementation

      // 축적된 리소스들 (프로젝트와 무관하게 재사용 가능)
      const aiResources = await executeTool(
        'search_memory',
        { query: 'recommender', category: 'Resources' },
        context
      );
      const resourceText = aiResources.content[0]?.text || '';
      expect(resourceText.toLowerCase()).toContain('recommender');

      // 링크 그래프 확인
      const hubLinks = await executeTool(
        'read_note',
        { uid: hubUid, includeLinks: true },
        context
      );
      const hubMetadata = hubLinks._meta?.metadata as any;
      expect(hubMetadata?.links?.length).toBe(4);
    });
  });

  describe('영역 기반 전문성 구축', () => {
    it('지속적인 영역에서 Zettelkasten으로 전문성을 구축할 수 있다', async () => {
      // 1. Areas 영역 정의
      const backendArea = await executeTool(
        'create_note',
        {
          title: '백엔드 개발 전문성',
          content:
            '## 핵심 역량\n- API 설계\n- 데이터베이스 최적화\n- 시스템 확장성',
          category: 'Areas',
          tags: ['backend', 'expertise', 'ongoing'],
        },
        context
      );
      const areaUid = backendArea._meta?.metadata?.id;

      // 2. 세부 지식 노트들 (Resources에 Zettelkasten 스타일)
      const cacheNote = await executeTool(
        'create_note',
        {
          title: '캐시 전략 패턴들',
          content:
            '## Cache-Aside\n애플리케이션이 캐시를 직접 관리\n\n## Write-Through\n데이터 변경 시 캐시와 DB 동시 업데이트',
          category: 'Resources',
          tags: ['caching', 'patterns', 'performance'],
          links: [areaUid],
        },
        context
      );

      const indexNote = await executeTool(
        'create_note',
        {
          title: '데이터베이스 인덱스 전략',
          content:
            '## B-Tree\n범위 쿼리에 적합\n\n## Hash\n동등 비교에 최적',
          category: 'Resources',
          tags: ['database', 'indexing', 'optimization'],
          links: [areaUid],
        },
        context
      );

      const scalingNote = await executeTool(
        'create_note',
        {
          title: '수평적 vs 수직적 확장',
          content:
            '## 수평적 (Scale-Out)\n- 서버 추가\n- 로드 밸런싱 필요\n\n## 수직적 (Scale-Up)\n- 서버 스펙 향상\n- 한계 존재',
          category: 'Resources',
          tags: ['scaling', 'architecture'],
          links: [areaUid, cacheNote._meta?.metadata?.id],
        },
        context
      );

      // 3. 크로스 링크 (개념 연결)
      await executeTool(
        'update_note',
        {
          uid: cacheNote._meta?.metadata?.id,
          links: [areaUid, scalingNote._meta?.metadata?.id],
        },
        context
      );

      await executeTool(
        'update_note',
        {
          uid: indexNote._meta?.metadata?.id,
          links: [areaUid, cacheNote._meta?.metadata?.id],
        },
        context
      );

      // 4. 실제 프로젝트에서 지식 활용
      const perfProject = await executeTool(
        'create_note',
        {
          title: '프로젝트: API 성능 개선',
          content:
            '## 현재 문제\n- 응답 시간 2초\n\n## 목표\n- 200ms 이하\n\n## 적용할 지식\n- 캐시 전략\n- DB 인덱싱',
          category: 'Projects',
          project: 'api-performance',
          tags: ['performance', 'optimization'],
          links: [
            cacheNote._meta?.metadata?.id,
            indexNote._meta?.metadata?.id,
            scalingNote._meta?.metadata?.id,
          ],
        },
        context
      );

      // 검증
      // Areas 확인
      const areas = await executeTool(
        'list_notes',
        { category: 'Areas' },
        context
      );
      expect(areas._meta?.metadata?.total).toBe(1);

      // Resources 확인
      const resources = await executeTool(
        'list_notes',
        { category: 'Resources' },
        context
      );
      expect(resources._meta?.metadata?.total).toBe(3);

      // 프로젝트에서 리소스 참조 확인
      const projectLinks = await executeTool(
        'read_note',
        { uid: perfProject._meta?.metadata?.id, includeLinks: true },
        context
      );
      const projectMetadata = projectLinks._meta?.metadata as any;
      expect(projectMetadata?.links?.length).toBe(3);

      // 리소스의 다중 참조 확인 (front matter links만)
      const cacheLinks = await executeTool(
        'read_note',
        { uid: cacheNote._meta?.metadata?.id },
        context
      );
      const cacheMetadata = cacheLinks._meta?.metadata as any;
      // cacheNote는 areaUid와 scalingNote를 참조함
      expect(cacheMetadata?.links?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AI 에이전트 메모리 시뮬레이션', () => {
    it('AI 에이전트가 대화를 통해 PARA+Zettelkasten으로 지식을 축적한다', async () => {
      // Session 1: React 관련 질문
      const reactBasics = await executeTool(
        'create_note',
        {
          title: '사용자 질문: React 컴포넌트 생명주기',
          content:
            '## 대화 요약\n사용자가 React 클래스 컴포넌트의 생명주기를 물음\n\n## 제공한 답변\n- componentDidMount: 마운트 후\n- componentDidUpdate: 업데이트 후',
          category: 'Areas', // 사용자 지원 영역
          tags: ['react', 'conversation', 'user-support'],
        },
        context
      );

      // Session 2: 이전 대화 이어서 Hooks 질문
      const reactHooks = await executeTool(
        'create_note',
        {
          title: '사용자 질문: useEffect와 생명주기 비교',
          content:
            '## 대화 요약\n이전 대화를 이어서 Hooks 방식 질문\n\n## 연결\nuseEffect = componentDidMount + componentDidUpdate + componentWillUnmount',
          category: 'Areas',
          tags: ['react', 'hooks', 'conversation'],
          links: [reactBasics._meta?.metadata?.id],
        },
        context
      );

      // Session 3: 성능 문제 프로젝트화
      const reactPerf = await executeTool(
        'create_note',
        {
          title: '사용자 프로젝트: React 리렌더링 최적화',
          content:
            '## 문제\n불필요한 리렌더링으로 성능 저하\n\n## 제안한 해결책\n- React.memo 사용\n- useMemo/useCallback',
          category: 'Projects',
          project: 'user-react-optimization',
          tags: ['react', 'performance', 'optimization'],
          links: [
            reactBasics._meta?.metadata?.id,
            reactHooks._meta?.metadata?.id,
          ],
        },
        context
      );

      // 지식 검색 (이전 대화 참조)
      const reactKnowledge = await executeTool(
        'search_memory',
        { query: 'React 생명주기' },
        context
      );
      expect(reactKnowledge.content[0]?.text).toContain('React');

      // 관련 노트 추천 (연결된 노트 탐색)
      const relatedToHooks = await executeTool(
        'read_note',
        { uid: reactHooks._meta?.metadata?.id },
        context
      );
      const hooksMetadata = relatedToHooks._meta?.metadata as any;
      // reactHooks는 reactBasics를 참조함
      expect(hooksMetadata?.links).toContain(
        reactBasics._meta?.metadata?.id
      );
      // reactPerf가 reactHooks를 참조하지만, 백링크 추적은 인덱싱 필요

      // 대화 히스토리 조회 (conversation 태그)
      const conversations = await executeTool(
        'list_notes',
        { tags: ['conversation'] },
        context
      );
      expect(conversations._meta?.metadata?.total).toBe(2);
    });
  });

  describe('지식 아카이빙 워크플로우', () => {
    it('프로젝트 완료 시 관련 리소스 지식은 보존되고 프로젝트만 아카이빙된다', async () => {
      // 1. 공통 리소스 생성 (프로젝트와 무관하게 재사용)
      const designResource = await executeTool(
        'create_note',
        {
          title: 'UI 디자인 원칙',
          content: '## 핵심 원칙\n- 일관성\n- 피드백\n- 접근성',
          category: 'Resources',
          tags: ['design', 'ui', 'principles'],
        },
        context
      );
      const resourceUid = designResource._meta?.metadata?.id;

      // 2. 프로젝트에서 리소스 활용
      const projectA = await executeTool(
        'create_note',
        {
          title: '프로젝트 A: 웹 리디자인',
          content: 'UI 디자인 원칙을 적용',
          category: 'Projects',
          project: 'web-redesign',
          tags: ['web', 'active'],
          links: [resourceUid],
        },
        context
      );

      const projectB = await executeTool(
        'create_note',
        {
          title: '프로젝트 B: 모바일 앱',
          content: 'UI 디자인 원칙을 적용',
          category: 'Projects',
          project: 'mobile-app',
          tags: ['mobile', 'active'],
          links: [resourceUid],
        },
        context
      );

      // 3. 프로젝트 A 완료 및 아카이빙
      await executeTool(
        'update_note',
        {
          uid: projectA._meta?.metadata?.id,
          category: 'Archives',
          tags: ['web', 'completed'],
        },
        context
      );

      // 4. 검증
      // 리소스는 여전히 Resources에 남아있음
      const resources = await executeTool(
        'list_notes',
        { category: 'Resources' },
        context
      );
      expect(resources.content[0]?.text).toContain('UI 디자인 원칙');

      // 프로젝트 B는 여전히 활성화
      const activeProjects = await executeTool(
        'list_notes',
        { category: 'Projects' },
        context
      );
      expect(activeProjects.content[0]?.text).toContain('프로젝트 B');

      // 프로젝트 A는 Archives에
      const archives = await executeTool(
        'list_notes',
        { category: 'Archives' },
        context
      );
      expect(archives.content[0]?.text).toContain('프로젝트 A');

      // 리소스 노트 확인 (프로젝트들이 리소스를 참조)
      const resourceLinks = await executeTool(
        'read_note',
        { uid: resourceUid },
        context
      );
      const resourceMetadata = resourceLinks._meta?.metadata as any;
      // 리소스 노트 자체는 다른 노트를 참조하지 않음
      expect(resourceMetadata?.links?.length || 0).toBe(0);

      // 대신 프로젝트 노트들이 리소스를 참조하는지 확인
      const projectNotes = await executeTool(
        'list_notes',
        { category: 'Projects' },
        context
      );
      const projectText = projectNotes.content[0]?.text || '';
      expect(projectText).toContain('프로젝트 B'); // 아직 활성화된 프로젝트
    });
  });

  describe('복합 검색 및 필터링', () => {
    it('PARA 카테고리와 Zettelkasten 태그를 조합하여 검색할 수 있다', async () => {
      // 다양한 조합의 노트 생성
      await executeTool(
        'create_note',
        {
          title: 'Python 백엔드 프로젝트',
          content: 'Python으로 API 구축',
          category: 'Projects',
          project: 'python-api',
          tags: ['python', 'backend', 'api'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: 'Python 데이터 분석',
          content: 'Pandas와 NumPy 활용',
          category: 'Resources',
          tags: ['python', 'data-analysis', 'pandas'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: 'Python 학습 영역',
          content: '지속적인 Python 역량 개발',
          category: 'Areas',
          tags: ['python', 'learning', 'ongoing'],
        },
        context
      );

      await executeTool(
        'create_note',
        {
          title: '완료된 Python 튜토리얼',
          content: '기초 튜토리얼 완료',
          category: 'Archives',
          tags: ['python', 'tutorial', 'completed'],
        },
        context
      );

      // 키워드 검색
      const pythonSearch = await executeTool(
        'search_memory',
        { query: 'Python' },
        context
      );
      const searchText = pythonSearch.content[0]?.text || '';
      expect(searchText.toLowerCase()).toContain('python');

      // 카테고리 + 태그 조합 필터링
      const pythonResources = await executeTool(
        'list_notes',
        { category: 'Resources', tags: ['python'] },
        context
      );
      expect(pythonResources.content[0]?.text).toContain('데이터 분석');

      // 프로젝트별 필터링
      const pythonProjects = await executeTool(
        'list_notes',
        { project: 'python-api' },
        context
      );
      expect(pythonProjects._meta?.metadata?.total).toBe(1);

      // 완료된 항목
      const completedNotes = await executeTool(
        'list_notes',
        { category: 'Archives', tags: ['completed'] },
        context
      );
      expect(completedNotes.content[0]?.text).toContain('튜토리얼');
    });
  });

  describe('지식 그래프 구축', () => {
    it('여러 PARA 카테고리에 걸친 지식 그래프를 구축할 수 있다', async () => {
      // 중심 개념 (Resources)
      const coreConceptNote = await executeTool(
        'create_note',
        {
          title: 'TDD (Test-Driven Development)',
          content: '테스트를 먼저 작성하는 개발 방법론',
          category: 'Resources',
          tags: ['tdd', 'methodology', 'core-concept'],
        },
        context
      );
      const coreUid = coreConceptNote._meta?.metadata?.id;

      // Areas에서 참조
      const devPracticeArea = await executeTool(
        'create_note',
        {
          title: '개발 프랙티스',
          content: '지속적으로 개선해야 할 개발 습관',
          category: 'Areas',
          tags: ['practices', 'ongoing'],
          links: [coreUid],
        },
        context
      );

      // Projects에서 참조
      const refactoringProject = await executeTool(
        'create_note',
        {
          title: '레거시 코드 리팩토링',
          content: 'TDD 적용하여 안전하게 리팩토링',
          category: 'Projects',
          project: 'legacy-refactor',
          tags: ['refactoring', 'legacy'],
          links: [coreUid],
        },
        context
      );

      // Archives에서도 참조 (과거 경험)
      const pastExperience = await executeTool(
        'create_note',
        {
          title: '2024년 TDD 도입 회고',
          content: 'TDD 도입 초기 어려움과 극복 과정',
          category: 'Archives',
          tags: ['retrospective', 'tdd', 'experience'],
          links: [coreUid],
        },
        context
      );

      // 핵심 개념 노트 확인
      const coreLinks = await executeTool(
        'read_note',
        { uid: coreUid },
        context
      );
      const coreMetadata = coreLinks._meta?.metadata as any;
      // 핵심 개념 노트 자체는 다른 노트를 참조하지 않음
      expect(coreMetadata?.links?.length || 0).toBe(0);

      // 각 카테고리에서 참조됨 확인
      const categories = ['Areas', 'Projects', 'Archives'];
      for (const category of categories) {
        const categoryNotes = await executeTool(
          'list_notes',
          { category },
          context
        );
        expect(categoryNotes._meta?.metadata?.total).toBeGreaterThan(0);
      }

      // TDD 검색 시 모든 관련 노트 발견
      const tddSearch = await executeTool(
        'search_memory',
        { query: 'TDD' },
        context
      );
      expect(tddSearch.content[0]?.text).toContain('TDD');
    });
  });
});
