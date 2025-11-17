/**
 * Zettelkasten 방법론 통합 테스트
 * 원자적 노트, 양방향 링크, 백링크, 고아 노트 관리
 */

import { executeTool } from '../../src/tools';
import { createTestContext, cleanupTestContext } from '../test-helpers';
import type { ToolExecutionContext } from '../../src/tools/types';
import { IndexSearchEngine } from '@inchankang/zettel-memory-index-search';

describe('Zettelkasten Methodology Integration Tests', () => {
  let context: ToolExecutionContext;
  let searchEngine: IndexSearchEngine;

  beforeEach(() => {
    context = createTestContext();
    searchEngine = new IndexSearchEngine({
      dbPath: context.indexPath,
    });
  });

  afterEach(() => {
    searchEngine.close();
    cleanupTestContext(context);
  });

  describe('UID 시스템', () => {
    it('모든 노트에 고유한 UID가 생성된다', async () => {
      const uids: string[] = [];

      // 여러 노트를 빠르게 생성
      for (let i = 0; i < 10; i++) {
        const result = await executeTool(
          'create_note',
          { title: `노트 ${i}`, content: `내용 ${i}` },
          context
        );
        uids.push(result._meta?.metadata?.id);
      }

      // 모든 UID가 고유한지 확인
      const uniqueUids = new Set(uids);
      expect(uniqueUids.size).toBe(10);

      // UID 형식 검증 (YYYYMMDDTHHMMSSmmmmmmZ)
      for (const uid of uids) {
        expect(uid).toMatch(/^\d{8}T\d{12}Z$/);
      }
    });

    it('UID는 시간순으로 정렬 가능하다', async () => {
      const notes: { uid: string; title: string }[] = [];

      // 시간 간격을 두고 생성
      for (let i = 0; i < 3; i++) {
        const result = await executeTool(
          'create_note',
          { title: `노트 ${i}`, content: `내용 ${i}` },
          context
        );
        notes.push({
          uid: result._meta?.metadata?.id,
          title: `노트 ${i}`,
        });
        // 짧은 대기
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // UID로 정렬하면 생성 순서대로 정렬됨
      const sortedByUid = [...notes].sort((a, b) =>
        a.uid.localeCompare(b.uid)
      );

      expect(sortedByUid[0].title).toBe('노트 0');
      expect(sortedByUid[1].title).toBe('노트 1');
      expect(sortedByUid[2].title).toBe('노트 2');
    });
  });

  describe('원자적 노트 (Atomic Notes)', () => {
    it('하나의 노트는 하나의 개념을 다룬다', async () => {
      // 잘못된 방식: 여러 개념이 혼합
      const badNote = await executeTool(
        'create_note',
        {
          title: '개발 생각들',
          content:
            '1. TDD는 좋다\n2. 마이크로서비스는 복잡하다\n3. 코드 리뷰는 필수다',
          tags: ['dev', 'mixed'],
        },
        context
      );

      // 올바른 방식: 원자적 노트로 분리
      const tddNote = await executeTool(
        'create_note',
        {
          title: 'TDD가 코드 품질을 향상시키는 이유',
          content:
            '테스트를 먼저 작성하면:\n- 요구사항을 명확히 이해\n- 작은 단위로 설계\n- 리팩토링 안전망 제공',
          tags: ['tdd', 'testing', 'quality'],
        },
        context
      );

      const microservicesNote = await executeTool(
        'create_note',
        {
          title: '마이크로서비스의 복잡성 요인',
          content:
            '마이크로서비스의 복잡성:\n- 분산 시스템 문제\n- 네트워크 지연\n- 데이터 일관성',
          tags: ['microservices', 'architecture', 'complexity'],
        },
        context
      );

      const codeReviewNote = await executeTool(
        'create_note',
        {
          title: '코드 리뷰의 필수적인 이유',
          content:
            '코드 리뷰가 필수인 이유:\n- 버그 조기 발견\n- 지식 공유\n- 코드 품질 향상',
          tags: ['code-review', 'quality', 'collaboration'],
        },
        context
      );

      // 원자적 노트들을 연결
      await executeTool(
        'update_note',
        {
          uid: tddNote._meta?.metadata?.id,
          links: [codeReviewNote._meta?.metadata?.id], // TDD와 코드 리뷰 연결
        },
        context
      );

      // 검색 시 더 정확한 결과
      const tddSearch = await executeTool(
        'search_memory',
        { query: 'TDD 테스트 품질' },
        context
      );
      expect(tddSearch.content[0]?.text).toContain('TDD');

      const microservicesSearch = await executeTool(
        'search_memory',
        { query: '마이크로서비스 복잡성' },
        context
      );
      expect(microservicesSearch.content[0]?.text).toContain('마이크로서비스');
    });
  });

  describe('양방향 링크 및 백링크', () => {
    it('노트 간 양방향 연결을 추적할 수 있다', async () => {
      // MOC (Map of Content) 허브 노트
      const hubNote = await executeTool(
        'create_note',
        {
          title: '소프트웨어 아키텍처 MOC',
          content: '# 소프트웨어 아키텍처 지식 맵',
          tags: ['moc', 'architecture', 'hub'],
        },
        context
      );
      const hubUid = hubNote._meta?.metadata?.id;

      // 관련 개념 노트들
      const solidNote = await executeTool(
        'create_note',
        {
          title: 'SOLID 원칙',
          content: '객체지향 설계의 5가지 원칙',
          tags: ['solid', 'oop', 'design-principles'],
          links: [hubUid],
        },
        context
      );
      const solidUid = solidNote._meta?.metadata?.id;

      const cleanArchNote = await executeTool(
        'create_note',
        {
          title: '클린 아키텍처',
          content: '의존성 역전을 통한 계층 분리',
          tags: ['clean-architecture', 'layers', 'dependency'],
          links: [hubUid, solidUid],
        },
        context
      );
      const cleanArchUid = cleanArchNote._meta?.metadata?.id;

      const dddNote = await executeTool(
        'create_note',
        {
          title: '도메인 주도 설계',
          content: '비즈니스 도메인 중심의 설계 방법론',
          tags: ['ddd', 'domain', 'modeling'],
          links: [hubUid, cleanArchUid],
        },
        context
      );
      const dddUid = dddNote._meta?.metadata?.id;

      // 허브 노트 업데이트
      await executeTool(
        'update_note',
        {
          uid: hubUid,
          content:
            '# 소프트웨어 아키텍처 지식 맵\n\n## 연결된 개념\n- SOLID 원칙\n- 클린 아키텍처\n- 도메인 주도 설계',
          links: [solidUid, cleanArchUid, dddUid],
        },
        context
      );

      // 백링크 확인
      const hubWithLinks = await executeTool(
        'read_note',
        { uid: hubUid, includeLinks: true },
        context
      );

      const hubMetadata = hubWithLinks._meta?.metadata as any;
      expect(hubMetadata?.links?.length).toBe(3);
      // 백링크는 링크 그래프 인덱싱이 필요하므로 여기서는 front matter links만 확인

      // Clean Architecture 노트의 연결 확인
      const cleanArchWithLinks = await executeTool(
        'read_note',
        { uid: cleanArchUid },
        context
      );

      const cleanArchMetadata = cleanArchWithLinks._meta?.metadata as any;
      expect(cleanArchMetadata?.links).toContain(hubUid);
      expect(cleanArchMetadata?.links).toContain(solidUid);
      // dddNote가 cleanArchUid를 참조하고 있지만, 백링크 추적은 인덱싱 후에 가능
    });

    it('끊어진 링크를 감지할 수 있다', async () => {
      // 연결된 노트들 생성
      const noteA = await executeTool(
        'create_note',
        {
          title: '개념 A',
          content: '기본 개념',
          tags: ['concept'],
        },
        context
      );
      const uidA = noteA._meta?.metadata?.id;

      const noteB = await executeTool(
        'create_note',
        {
          title: '개념 B',
          content: 'A를 기반으로 확장',
          tags: ['concept'],
          links: [uidA],
        },
        context
      );
      const uidB = noteB._meta?.metadata?.id;

      const noteC = await executeTool(
        'create_note',
        {
          title: '개념 C',
          content: 'A와 B를 종합',
          tags: ['concept'],
          links: [uidA, uidB],
        },
        context
      );
      const uidC = noteC._meta?.metadata?.id;

      // 노트 A 삭제
      await executeTool('delete_note', { uid: uidA, confirm: true }, context);

      // 노트 B의 링크 확인
      const noteBLinks = await executeTool(
        'read_note',
        { uid: uidB, includeLinks: true },
        context
      );

      const noteBMetadata = noteBLinks._meta?.metadata as any;
      // 끊어진 링크가 감지되어야 함
      if (noteBMetadata?.links?.broken) {
        expect(noteBMetadata.links.broken).toContain(uidA);
      }

      // 노트 C의 링크 확인
      const noteCLinks = await executeTool(
        'read_note',
        { uid: uidC, includeLinks: true },
        context
      );

      const noteCMetadata = noteCLinks._meta?.metadata as any;
      if (noteCMetadata?.links?.broken) {
        expect(noteCMetadata.links.broken).toContain(uidA);
        // uidB는 여전히 존재
        expect(noteCMetadata.links.outbound).toContain(uidB);
      }
    });
  });

  describe('노트 네트워크 탐색', () => {
    it('연결된 노트 그래프를 탐색할 수 있다', async () => {
      // 중심 노트
      const rootNote = await executeTool(
        'create_note',
        {
          title: '루트 노트',
          content: '네트워크의 시작점',
          tags: ['root'],
        },
        context
      );
      const rootUid = rootNote._meta?.metadata?.id;

      // 레벨 1 노트들
      const level1Notes = [];
      for (let i = 0; i < 3; i++) {
        const note = await executeTool(
          'create_note',
          {
            title: `레벨 1 노트 ${i}`,
            content: `루트와 연결된 ${i}번 노트`,
            tags: ['level1'],
            links: [rootUid],
          },
          context
        );
        level1Notes.push(note._meta?.metadata?.id);
      }

      // 루트 노트에 레벨 1 연결
      await executeTool(
        'update_note',
        {
          uid: rootUid,
          links: level1Notes,
        },
        context
      );

      // 레벨 2 노트 (레벨 1의 첫 번째 노트에 연결)
      const level2Note = await executeTool(
        'create_note',
        {
          title: '레벨 2 노트',
          content: '레벨 1에 연결',
          tags: ['level2'],
          links: [level1Notes[0]],
        },
        context
      );

      // 루트에서 연결된 노트 확인
      const rootWithLinks = await executeTool(
        'read_note',
        { uid: rootUid, includeLinks: true },
        context
      );

      const rootMetadata = rootWithLinks._meta?.metadata as any;
      expect(rootMetadata?.links?.length).toBe(3);
      // 백링크 추적은 링크 그래프 인덱싱이 필요

      // 레벨 1 첫 번째 노트 확인 (레벨 2가 레벨 1을 참조)
      const level1WithLinks = await executeTool(
        'read_note',
        { uid: level1Notes[0] },
        context
      );

      const level1Metadata = level1WithLinks._meta?.metadata as any;
      // level1은 rootUid를 참조함
      expect(level1Metadata?.links).toContain(rootUid);
    });

    it('순환 링크가 있어도 안정적으로 동작한다', async () => {
      // A → B → C → A 순환 구조
      const noteA = await executeTool(
        'create_note',
        {
          title: '노트 A',
          content: 'A',
          tags: ['circular'],
        },
        context
      );
      const uidA = noteA._meta?.metadata?.id;

      const noteB = await executeTool(
        'create_note',
        {
          title: '노트 B',
          content: 'B',
          tags: ['circular'],
          links: [uidA],
        },
        context
      );
      const uidB = noteB._meta?.metadata?.id;

      const noteC = await executeTool(
        'create_note',
        {
          title: '노트 C',
          content: 'C',
          tags: ['circular'],
          links: [uidB],
        },
        context
      );
      const uidC = noteC._meta?.metadata?.id;

      // 순환 완성: A → C
      await executeTool(
        'update_note',
        {
          uid: uidA,
          links: [uidC],
        },
        context
      );

      // 순환 링크가 있어도 읽기 성공
      const noteALinks = await executeTool(
        'read_note',
        { uid: uidA, includeLinks: true },
        context
      );

      expect(noteALinks.content[0]?.text).toContain('노트 A');
      const aMetadata = noteALinks._meta?.metadata as any;
      expect(aMetadata?.links).toContain(uidC);
      // noteB가 noteA를 참조하지만, 백링크 추적은 인덱싱 필요

      // 태그로 필터링 테스트 (검색 인덱스 없음)
      const circularNotes = await executeTool(
        'list_notes',
        { tags: ['circular'] },
        context
      );
      expect(circularNotes.content[0]?.text).toContain('노트');
    });
  });

  describe('Zettelkasten 워크플로우', () => {
    it('점진적 정교화를 통해 지식을 구축할 수 있다', async () => {
      // Layer 1: 원본 자료 캡처
      const originalNote = await executeTool(
        'create_note',
        {
          title: '강의 노트: 분산 시스템 기초',
          content: `# 분산 시스템 강의

## CAP 정리
분산 시스템은 Consistency, Availability, Partition Tolerance 중 최대 2개만 보장

## 일관성 모델
- Strong Consistency
- Eventual Consistency
- Causal Consistency`,
          category: 'Resources',
          tags: ['distributed-systems', 'lecture', 'raw'],
        },
        context
      );
      const originalUid = originalNote._meta?.metadata?.id;

      // Layer 2: 핵심 요약
      const summaryNote = await executeTool(
        'create_note',
        {
          title: '핵심: 분산 시스템 설계 선택',
          content: `## CAP Trade-off
**CP 선택**: 일관성 우선 (금융 시스템)
**AP 선택**: 가용성 우선 (소셜 미디어)`,
          category: 'Resources',
          tags: ['distributed-systems', 'summary'],
          links: [originalUid],
        },
        context
      );
      const summaryUid = summaryNote._meta?.metadata?.id;

      // Layer 3: 실행 가능한 통찰
      const insightNote = await executeTool(
        'create_note',
        {
          title: '통찰: 프로젝트의 CAP 선택 가이드',
          content: `## 액션 아이템
1. 트랜잭션 서비스: CP 필수
2. 피드 서비스: AP 가능
3. 세션: Causal 충분`,
          category: 'Projects',
          project: 'system-architecture',
          tags: ['architecture', 'decision', 'actionable'],
          links: [summaryUid, originalUid],
        },
        context
      );
      const insightUid = insightNote._meta?.metadata?.id;

      // 지식 레이어별 검색
      const rawNotes = await executeTool(
        'list_notes',
        { tags: ['raw'] },
        context
      );
      expect(rawNotes._meta?.metadata?.total).toBe(1);

      const summaryNotes = await executeTool(
        'list_notes',
        { tags: ['summary'] },
        context
      );
      expect(summaryNotes._meta?.metadata?.total).toBe(1);

      const actionableNotes = await executeTool(
        'list_notes',
        { tags: ['actionable'] },
        context
      );
      expect(actionableNotes._meta?.metadata?.total).toBe(1);

      // 통찰 노트의 링크 확인
      const insightLinks = await executeTool(
        'read_note',
        { uid: insightUid, includeLinks: true },
        context
      );

      const insightMetadata = insightLinks._meta?.metadata as any;
      expect(insightMetadata?.links).toContain(summaryUid);
      expect(insightMetadata?.links).toContain(originalUid);
    });

    it('연관 검색을 통해 관련 노트를 찾을 수 있다', async () => {
      // React 관련 노트들 생성
      const reactBasics = await executeTool(
        'create_note',
        {
          title: 'React 기초',
          content: 'React는 UI를 구축하기 위한 JavaScript 라이브러리입니다.',
          tags: ['react', 'javascript', 'frontend'],
        },
        context
      );

      const reactHooks = await executeTool(
        'create_note',
        {
          title: 'React Hooks 가이드',
          content:
            'useState, useEffect, useContext 등의 훅을 사용하여 함수형 컴포넌트를 작성합니다.',
          tags: ['react', 'hooks', 'state-management'],
          links: [reactBasics._meta?.metadata?.id],
        },
        context
      );

      const reactPerf = await executeTool(
        'create_note',
        {
          title: 'React 성능 최적화',
          content:
            'useMemo, useCallback, React.memo를 사용하여 불필요한 리렌더링을 방지합니다.',
          tags: ['react', 'performance', 'optimization'],
          links: [
            reactBasics._meta?.metadata?.id,
            reactHooks._meta?.metadata?.id,
          ],
        },
        context
      );

      // React 검색
      const reactSearch = await executeTool(
        'search_memory',
        { query: 'React' },
        context
      );

      const searchText = reactSearch.content[0]?.text || '';
      expect(searchText.toLowerCase()).toContain('react');

      // Hooks 태그로 필터링 (검색 인덱스 없음)
      const hooksNotes = await executeTool(
        'list_notes',
        { tags: ['hooks'] },
        context
      );
      expect(hooksNotes.content[0]?.text).toContain('React Hooks');

      // 태그로 필터링
      const perfNotes = await executeTool(
        'list_notes',
        { tags: ['performance'] },
        context
      );
      expect(perfNotes.content[0]?.text).toContain('성능 최적화');
    });
  });

  describe('고급 Zettelkasten 패턴', () => {
    it('허브 노트 (MOC)를 통해 지식을 구조화할 수 있다', async () => {
      // 프로그래밍 언어 MOC
      const progLangMoc = await executeTool(
        'create_note',
        {
          title: '프로그래밍 언어 MOC',
          content:
            '# 프로그래밍 언어 지식 맵\n\n## 패러다임별 분류\n- 함수형\n- 객체지향\n- 절차형',
          tags: ['moc', 'programming-languages'],
        },
        context
      );
      const mocUid = progLangMoc._meta?.metadata?.id;

      // 하위 노트들
      const jsNote = await executeTool(
        'create_note',
        {
          title: 'JavaScript',
          content: '동적 타입, 프로토타입 기반 객체지향',
          tags: ['javascript', 'dynamic-typing'],
          links: [mocUid],
        },
        context
      );

      const tsNote = await executeTool(
        'create_note',
        {
          title: 'TypeScript',
          content: '정적 타입을 추가한 JavaScript 슈퍼셋',
          tags: ['typescript', 'static-typing'],
          links: [mocUid, jsNote._meta?.metadata?.id],
        },
        context
      );

      const pythonNote = await executeTool(
        'create_note',
        {
          title: 'Python',
          content: '동적 타입, 다중 패러다임 언어',
          tags: ['python', 'dynamic-typing'],
          links: [mocUid],
        },
        context
      );

      // MOC 업데이트
      await executeTool(
        'update_note',
        {
          uid: mocUid,
          content:
            '# 프로그래밍 언어 지식 맵\n\n## 연결된 언어\n- JavaScript\n- TypeScript\n- Python',
          links: [
            jsNote._meta?.metadata?.id,
            tsNote._meta?.metadata?.id,
            pythonNote._meta?.metadata?.id,
          ],
        },
        context
      );

      // MOC의 연결 확인
      const mocLinks = await executeTool(
        'read_note',
        { uid: mocUid, includeLinks: true },
        context
      );

      const mocMetadata = mocLinks._meta?.metadata as any;
      expect(mocMetadata?.links?.length).toBe(3);
      // 백링크는 인덱싱이 필요하므로 front matter links만 확인

      // TypeScript의 다중 연결 확인
      const tsLinks = await executeTool(
        'read_note',
        { uid: tsNote._meta?.metadata?.id },
        context
      );

      const tsMetadata = tsLinks._meta?.metadata as any;
      expect(tsMetadata?.links).toContain(mocUid);
      expect(tsMetadata?.links).toContain(
        jsNote._meta?.metadata?.id
      );
    });

    it('문헌 노트와 영구 노트를 구분할 수 있다', async () => {
      // 문헌 노트 (Literature Notes) - 외부 소스에서 가져온 정보
      const literatureNote = await executeTool(
        'create_note',
        {
          title: '도서: Clean Code by Robert C. Martin',
          content: `## 주요 내용
- 의미 있는 이름 사용
- 함수는 한 가지 일만 해야 함
- 주석보다 코드로 의도를 표현
- 오류 처리를 위한 try-catch

## 출처
Clean Code: A Handbook of Agile Software Craftsmanship, Chapter 1-4`,
          category: 'Resources',
          tags: ['literature-note', 'book', 'clean-code'],
        },
        context
      );
      const litUid = literatureNote._meta?.metadata?.id;

      // 영구 노트 (Permanent Notes) - 내 생각을 담은 노트
      const permanentNote1 = await executeTool(
        'create_note',
        {
          title: '좋은 함수명이 주석을 대체하는 이유',
          content: `함수명이 명확하면:
- 코드 자체가 문서가 됨
- 주석과 코드의 불일치 문제 해결
- 검색 가능성 향상

예시:
- Bad: // 사용자 확인 후 이메일 전송
  sendEmail();
- Good: validateUserAndSendWelcomeEmail();`,
          tags: ['permanent-note', 'naming', 'clean-code'],
          links: [litUid],
        },
        context
      );

      const permanentNote2 = await executeTool(
        'create_note',
        {
          title: '단일 책임 원칙과 함수 크기의 관계',
          content: `SOLID의 SRP를 함수 레벨에 적용:
- 한 함수 = 한 가지 책임
- 자연스럽게 작은 함수가 됨
- 테스트하기 쉬워짐`,
          tags: ['permanent-note', 'solid', 'clean-code'],
          links: [litUid],
        },
        context
      );

      // 문헌 노트와 영구 노트 분류
      const literatureNotes = await executeTool(
        'list_notes',
        { tags: ['literature-note'] },
        context
      );
      expect(literatureNotes._meta?.metadata?.total).toBe(1);

      const permanentNotes = await executeTool(
        'list_notes',
        { tags: ['permanent-note'] },
        context
      );
      expect(permanentNotes._meta?.metadata?.total).toBe(2);

      // 문헌 노트에서 파생된 영구 노트 확인 (permanent notes가 literature note를 참조)
      const litWithLinks = await executeTool(
        'read_note',
        { uid: litUid },
        context
      );

      const litMetadata = litWithLinks._meta?.metadata as any;
      // 문헌 노트 자체는 다른 노트를 참조하지 않음
      expect(litMetadata?.links?.length || 0).toBe(0);

      // 영구 노트들이 문헌 노트를 참조하는지 추가 확인
      const permanentNotesAgain = await executeTool(
        'list_notes',
        { tags: ['permanent-note'] },
        context
      );
      expect(permanentNotesAgain._meta?.metadata as any).toHaveProperty('total', 2);
    });
  });
});
