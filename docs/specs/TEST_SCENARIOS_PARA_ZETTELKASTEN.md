# MCP 서버 테스트 시나리오: PARA + Zettelkasten 검증

> **목적**: 단순한 기본 테스트부터 복잡한 전문 시나리오까지 체계적으로 구성하여 PARA 메모법과 Zettelkasten 메모법이 MCP 서버에서 올바르게 작동하는지 검증

---

## 목차

1. [Level 1: 기초 (Basic)](#level-1-기초-basic)
2. [Level 2: 중급 (Intermediate)](#level-2-중급-intermediate)
3. [Level 3: 고급 - PARA 방법론](#level-3-고급---para-방법론)
4. [Level 4: 고급 - Zettelkasten 방법론](#level-4-고급---zettelkasten-방법론)
5. [Level 5: 전문가 - 통합 시나리오](#level-5-전문가---통합-시나리오)
6. [Level 6: 스트레스 및 엣지 케이스](#level-6-스트레스-및-엣지-케이스)

---

## Level 1: 기초 (Basic)

### 1.1 단일 도구 작동 검증

#### TC-1.1.1: 노트 생성 (create_note)
**목적**: 기본적인 노트 생성이 정상 작동하는지 확인

```json
// Input
{
  "title": "첫 번째 노트",
  "content": "이것은 테스트 노트입니다."
}

// Expected Output
- UID가 생성됨 (YYYYMMDDTHHMMSSmmmmmmZ 형식)
- 파일이 vault 경로에 저장됨
- Front Matter에 기본값 설정:
  - tags: []
  - links: []
  - created/updated: 현재 시간
  - category: undefined (선택사항)
```

**검증 포인트**:
- [ ] UID 형식 검증
- [ ] 파일 존재 여부 확인
- [ ] Front Matter 파싱 가능
- [ ] 콘텐츠 무결성 확인

#### TC-1.1.2: 노트 읽기 (read_note)
**목적**: 저장된 노트를 정확히 읽을 수 있는지 확인

```json
// Input
{
  "uid": "<이전 생성된 UID>"
}

// Expected Output
- title, content, category, tags, links 반환
- Markdown 형식으로 포맷팅
```

#### TC-1.1.3: 노트 목록 조회 (list_notes)
**목적**: 모든 노트를 조회할 수 있는지 확인

```json
// Input
{}

// Expected Output
- 모든 노트 목록 반환
- 기본 정렬: updated DESC
- 기본 limit: 100
```

#### TC-1.1.4: 노트 검색 (search_memory)
**목적**: 전문 검색이 작동하는지 확인

```json
// Input
{
  "query": "테스트"
}

// Expected Output
- 검색 결과 목록
- 각 결과에 score, snippet 포함
- searchTimeMs 메트릭 포함
```

#### TC-1.1.5: 노트 수정 (update_note)
**목적**: 노트 필드를 수정할 수 있는지 확인

```json
// Input
{
  "uid": "<UID>",
  "content": "수정된 내용입니다."
}

// Expected Output
- updated 타임스탬프 갱신
- content만 변경, 다른 필드 유지
```

#### TC-1.1.6: 노트 삭제 (delete_note)
**목적**: 노트를 안전하게 삭제할 수 있는지 확인

```json
// Input
{
  "uid": "<UID>",
  "confirm": true
}

// Expected Output
- 파일 삭제됨
- 인덱스에서 제거됨
- 삭제 확인 메시지
```

---

## Level 2: 중급 (Intermediate)

### 2.1 CRUD 워크플로우 검증

#### TC-2.1.1: 완전한 생명주기 테스트
**시나리오**: Create → Read → Update → Read → Delete → Verify

```typescript
const workflow = async () => {
  // 1. Create
  const created = await createNote({
    title: "생명주기 테스트",
    content: "초기 내용",
    tags: ["test", "lifecycle"]
  });

  // 2. Read - 생성 확인
  const read1 = await readNote({ uid: created.uid });
  expect(read1.content).toBe("초기 내용");

  // 3. Update
  await updateNote({
    uid: created.uid,
    content: "수정된 내용",
    tags: ["test", "lifecycle", "updated"]
  });

  // 4. Read - 수정 확인
  const read2 = await readNote({ uid: created.uid });
  expect(read2.content).toBe("수정된 내용");
  expect(read2.tags).toContain("updated");

  // 5. Delete
  await deleteNote({ uid: created.uid, confirm: true });

  // 6. Verify deletion
  const readDeleted = await readNote({ uid: created.uid });
  expect(readDeleted).toThrowError();
};
```

**검증 포인트**:
- [ ] 각 단계 성공 여부
- [ ] 데이터 일관성 유지
- [ ] 타임스탬프 정확성
- [ ] 인덱스 동기화

### 2.2 다중 노트 작업

#### TC-2.2.1: 여러 노트 생성 및 검색
**시나리오**: 10개의 노트를 생성하고 검색/필터링

```typescript
const multiNoteTest = async () => {
  // 다양한 카테고리와 태그로 10개 노트 생성
  const notes = [
    { title: "React Hooks 가이드", category: "Resources", tags: ["react", "frontend"] },
    { title: "API 설계 원칙", category: "Resources", tags: ["api", "backend"] },
    { title: "버그 수정 #123", category: "Projects", tags: ["bug", "urgent"] },
    { title: "팀 회의록", category: "Areas", tags: ["meeting", "team"] },
    { title: "레거시 코드 분석", category: "Archives", tags: ["legacy", "analysis"] },
    // ... 5개 더
  ];

  // 검색 테스트
  const searchResults = await searchMemory({ query: "react" });
  expect(searchResults).toContainNote("React Hooks 가이드");

  // 카테고리 필터링
  const resources = await listNotes({ category: "Resources" });
  expect(resources.length).toBe(2);

  // 태그 필터링
  const frontendNotes = await listNotes({ tags: ["frontend"] });
  expect(frontendNotes.length).toBeGreaterThan(0);
};
```

### 2.3 페이지네이션 및 정렬

#### TC-2.3.1: 페이지네이션 검증
```typescript
const paginationTest = async () => {
  // 25개 노트 생성
  for (let i = 0; i < 25; i++) {
    await createNote({ title: `노트 ${i}`, content: `내용 ${i}` });
  }

  // 첫 페이지
  const page1 = await listNotes({ limit: 10, offset: 0 });
  expect(page1.returnedResults).toBe(10);
  expect(page1.hasMore).toBe(true);

  // 두 번째 페이지
  const page2 = await listNotes({ limit: 10, offset: 10 });
  expect(page2.returnedResults).toBe(10);

  // 마지막 페이지
  const page3 = await listNotes({ limit: 10, offset: 20 });
  expect(page3.returnedResults).toBe(5);
  expect(page3.hasMore).toBe(false);
};
```

#### TC-2.3.2: 다양한 정렬 옵션
```typescript
const sortingTest = async () => {
  // 시간차를 두고 노트 생성
  const notes = [];
  for (const title of ["Z노트", "A노트", "M노트"]) {
    notes.push(await createNote({ title, content: "내용" }));
    await sleep(100); // 타임스탬프 차이를 위해
  }

  // 제목순 ASC
  const byTitleAsc = await listNotes({ sortBy: 'title', sortOrder: 'asc' });
  expect(byTitleAsc[0].title).toBe("A노트");

  // 제목순 DESC
  const byTitleDesc = await listNotes({ sortBy: 'title', sortOrder: 'desc' });
  expect(byTitleDesc[0].title).toBe("Z노트");

  // 생성일순
  const byCreated = await listNotes({ sortBy: 'created', sortOrder: 'asc' });
  expect(byCreated[0].title).toBe("Z노트");

  // 수정일순 (기본값)
  const byUpdated = await listNotes({ sortBy: 'updated', sortOrder: 'desc' });
  expect(byUpdated[0].title).toBe("M노트");
};
```

---

## Level 3: 고급 - PARA 방법론

### 3.1 PARA 카테고리 분류 검증

#### TC-3.1.1: Projects (프로젝트) 카테고리
**정의**: 마감일이 있는 단기 목표, 완료 가능한 작업

```typescript
const projectsTest = async () => {
  // 프로젝트 관련 노트 생성
  const projectNotes = [
    {
      title: "웹사이트 리디자인 계획",
      content: "## 목표\n- 현대적인 UI/UX\n- 성능 개선\n\n## 마감일\n2025-12-31",
      category: "Projects",
      project: "website-redesign",
      tags: ["planning", "ui", "performance"]
    },
    {
      title: "API v2 마이그레이션",
      content: "## 작업 항목\n1. 스키마 업데이트\n2. 클라이언트 수정\n3. 테스트",
      category: "Projects",
      project: "api-v2-migration",
      tags: ["api", "migration", "backend"]
    },
    {
      title: "모바일 앱 출시 준비",
      content: "## 체크리스트\n- [ ] 스토어 등록\n- [ ] 마케팅 자료",
      category: "Projects",
      project: "mobile-app-launch",
      tags: ["mobile", "launch", "marketing"]
    }
  ];

  // 프로젝트별 필터링
  const redesignNotes = await listNotes({ project: "website-redesign" });
  expect(redesignNotes.length).toBe(1);

  // 프로젝트 카테고리 전체 조회
  const allProjects = await listNotes({ category: "Projects" });
  expect(allProjects.length).toBe(3);

  // 프로젝트 완료 후 Archives로 이동
  await updateNote({
    uid: projectNotes[0].uid,
    category: "Archives"
  });

  const archivedProjects = await listNotes({ category: "Archives" });
  expect(archivedProjects).toContainNote("웹사이트 리디자인 계획");
};
```

#### TC-3.1.2: Areas (영역) 카테고리
**정의**: 지속적으로 관리해야 하는 책임 영역, 마감일 없음

```typescript
const areasTest = async () => {
  const areaNotes = [
    {
      title: "건강 관리 루틴",
      content: "## 일일 습관\n- 운동 30분\n- 물 8잔\n- 7시간 수면",
      category: "Areas",
      tags: ["health", "routine", "habits"]
    },
    {
      title: "재정 관리 원칙",
      content: "## 월별 예산\n- 저축: 30%\n- 필수: 50%\n- 여가: 20%",
      category: "Areas",
      tags: ["finance", "budget", "management"]
    },
    {
      title: "팀 리더십",
      content: "## 핵심 책임\n- 1:1 미팅\n- 코드 리뷰\n- 멘토링",
      category: "Areas",
      tags: ["leadership", "team", "management"]
    },
    {
      title: "지속적 학습",
      content: "## 학습 영역\n- 새로운 기술\n- 소프트 스킬\n- 도메인 지식",
      category: "Areas",
      tags: ["learning", "growth", "development"]
    }
  ];

  // Areas는 시간이 지나도 유지됨
  const areas = await listNotes({ category: "Areas" });
  expect(areas.length).toBe(4);

  // 특정 영역 검색
  const healthAreas = await searchMemory({
    query: "건강",
    category: "Areas"
  });
  expect(healthAreas.length).toBeGreaterThan(0);
};
```

#### TC-3.1.3: Resources (자원) 카테고리
**정의**: 관심 주제별 참고 자료, 재사용 가능한 정보

```typescript
const resourcesTest = async () => {
  const resourceNotes = [
    {
      title: "TypeScript 타입 가드 패턴",
      content: "```typescript\nfunction isString(value: unknown): value is string {\n  return typeof value === 'string';\n}\n```",
      category: "Resources",
      tags: ["typescript", "patterns", "type-guards"]
    },
    {
      title: "Git Rebase vs Merge",
      content: "## Rebase\n- 선형 히스토리\n- 깔끔한 로그\n\n## Merge\n- 브랜치 보존\n- 안전함",
      category: "Resources",
      tags: ["git", "workflow", "version-control"]
    },
    {
      title: "REST API 상태 코드",
      content: "- 200: OK\n- 201: Created\n- 400: Bad Request\n- 404: Not Found\n- 500: Server Error",
      category: "Resources",
      tags: ["api", "http", "reference"]
    },
    {
      title: "색상 팔레트 모음",
      content: "## Primary\n- #3498db\n- #2ecc71\n\n## Neutral\n- #95a5a6",
      category: "Resources",
      tags: ["design", "colors", "reference"]
    }
  ];

  // 프로젝트에서 리소스 참조
  const projectNote = await createNote({
    title: "API 개발 작업",
    content: "REST API 상태 코드 참조하여 구현",
    category: "Projects",
    links: [resourceNotes[2].uid] // REST API 상태 코드 연결
  });

  // 리소스 검색
  const typescriptResources = await searchMemory({
    query: "TypeScript",
    category: "Resources"
  });
  expect(typescriptResources.length).toBeGreaterThan(0);
};
```

#### TC-3.1.4: Archives (보관) 카테고리
**정의**: 완료되었거나 더 이상 활성화되지 않은 항목

```typescript
const archivesTest = async () => {
  // 완료된 프로젝트 보관
  const completedProject = await createNote({
    title: "2024 Q4 마케팅 캠페인",
    content: "## 완료됨\n- ROI: 150%\n- 신규 고객: 500명",
    category: "Archives",
    tags: ["completed", "marketing", "2024"]
  });

  // 비활성 영역 보관
  const inactiveArea = await createNote({
    title: "이전 팀 프로세스",
    content: "## 레거시\n더 이상 사용하지 않는 프로세스",
    category: "Archives",
    tags: ["legacy", "process", "inactive"]
  });

  // 오래된 리소스 보관
  const outdatedResource = await createNote({
    title: "React Class Components (구버전)",
    content: "## 참고용\nHooks 이전 방식",
    category: "Archives",
    tags: ["react", "legacy", "reference"]
  });

  // Archives 검색
  const archives = await listNotes({ category: "Archives" });
  expect(archives.length).toBe(3);

  // 연도별 필터링
  const archives2024 = await searchMemory({
    query: "2024",
    category: "Archives"
  });
};
```

### 3.2 PARA 워크플로우 시나리오

#### TC-3.2.1: 프로젝트 생명주기
**시나리오**: 프로젝트 시작 → 진행 → 완료 → 보관

```typescript
const projectLifecycleTest = async () => {
  // 1. 프로젝트 시작
  const project = await createNote({
    title: "새 기능 개발: 사용자 대시보드",
    content: "## 요구사항\n- 실시간 통계\n- 커스텀 위젯\n- 데이터 내보내기",
    category: "Projects",
    project: "user-dashboard",
    tags: ["feature", "dashboard", "in-progress"]
  });

  // 2. 관련 노트들 생성 (같은 프로젝트에 연결)
  const taskNote1 = await createNote({
    title: "대시보드 DB 스키마 설계",
    content: "## Tables\n- user_widgets\n- dashboard_layouts\n- widget_data",
    category: "Projects",
    project: "user-dashboard",
    tags: ["database", "schema"]
  });

  const taskNote2 = await createNote({
    title: "대시보드 API 엔드포인트",
    content: "## Endpoints\n- GET /dashboard\n- POST /widgets\n- PUT /layout",
    category: "Projects",
    project: "user-dashboard",
    tags: ["api", "endpoints"]
  });

  // 3. 프로젝트별 노트 조회
  const dashboardNotes = await listNotes({ project: "user-dashboard" });
  expect(dashboardNotes.length).toBe(3);

  // 4. 프로젝트 완료 - 모든 관련 노트를 Archives로 이동
  for (const note of dashboardNotes) {
    await updateNote({
      uid: note.uid,
      category: "Archives",
      tags: [...note.tags, "completed"]
    });
  }

  // 5. 검증
  const activeProjects = await listNotes({
    category: "Projects",
    project: "user-dashboard"
  });
  expect(activeProjects.length).toBe(0);

  const archivedDashboard = await listNotes({
    category: "Archives",
    project: "user-dashboard"
  });
  expect(archivedDashboard.length).toBe(3);
};
```

#### TC-3.2.2: 영역에서 프로젝트로 전환
**시나리오**: 지속적인 영역에서 구체적인 프로젝트 생성

```typescript
const areaToProjectTest = async () => {
  // 1. 영역 정의
  const learningArea = await createNote({
    title: "기술 학습",
    content: "## 학습 분야\n- 클라우드 컴퓨팅\n- 머신러닝\n- DevOps",
    category: "Areas",
    tags: ["learning", "technology"]
  });

  // 2. 영역에서 구체적인 프로젝트 생성
  const awsCertProject = await createNote({
    title: "AWS Solutions Architect 자격증 취득",
    content: "## 목표\n자격증 취득 by 2025-06-30\n\n## 참조\n기술 학습 영역에서 파생",
    category: "Projects",
    project: "aws-certification",
    tags: ["aws", "certification", "learning"],
    links: [learningArea.uid] // 영역과 연결
  });

  // 3. 영역 노트 업데이트 (프로젝트 참조 추가)
  await updateNote({
    uid: learningArea.uid,
    content: learningArea.content + "\n\n## 현재 프로젝트\n- AWS 자격증 취득",
    links: [awsCertProject.uid]
  });

  // 4. 양방향 연결 확인
  const areaWithLinks = await readNote({
    uid: learningArea.uid,
    includeLinks: true
  });
  expect(areaWithLinks.outboundLinks).toContain(awsCertProject.uid);
};
```

#### TC-3.2.3: 리소스 활용 패턴
**시나리오**: 여러 프로젝트에서 동일 리소스 참조

```typescript
const resourceUtilizationTest = async () => {
  // 1. 공통 리소스 생성
  const designSystem = await createNote({
    title: "회사 디자인 시스템 가이드",
    content: "## 색상\n- Primary: #0066CC\n- Secondary: #FF9900\n\n## 타이포그래피\n- Heading: Inter\n- Body: Roboto",
    category: "Resources",
    tags: ["design-system", "ui", "brand"]
  });

  // 2. 여러 프로젝트에서 참조
  const projectA = await createNote({
    title: "마케팅 랜딩 페이지",
    content: "디자인 시스템 가이드에 따라 구현",
    category: "Projects",
    project: "marketing-landing",
    links: [designSystem.uid]
  });

  const projectB = await createNote({
    title: "고객 포털 리뉴얼",
    content: "브랜드 가이드라인 준수",
    category: "Projects",
    project: "customer-portal",
    links: [designSystem.uid]
  });

  const projectC = await createNote({
    title: "모바일 앱 UI 개선",
    content: "일관된 디자인 시스템 적용",
    category: "Projects",
    project: "mobile-ui",
    links: [designSystem.uid]
  });

  // 3. 리소스의 백링크 확인
  const resourceBacklinks = await readNote({
    uid: designSystem.uid,
    includeLinks: true
  });
  expect(resourceBacklinks.inboundLinks.length).toBe(3);

  // 4. 리소스 업데이트가 모든 프로젝트에 영향
  await updateNote({
    uid: designSystem.uid,
    content: designSystem.content + "\n\n## 업데이트 (2025-01)\n- 새로운 아이콘 세트 추가",
    tags: [...designSystem.tags, "updated"]
  });
};
```

---

## Level 4: 고급 - Zettelkasten 방법론

### 4.1 원자적 노트 (Atomic Notes)

#### TC-4.1.1: 단일 아이디어 노트
**원칙**: 하나의 노트에는 하나의 아이디어만

```typescript
const atomicNotesTest = async () => {
  // 잘못된 예: 여러 아이디어가 혼합된 노트
  const badNote = await createNote({
    title: "개발 관련 생각들",
    content: "1. TDD는 좋다\n2. 마이크로서비스 아키텍처\n3. 코드 리뷰 방법",
    tags: ["dev", "thoughts"]
  });

  // 올바른 예: 원자적 노트로 분리
  const tddNote = await createNote({
    title: "TDD가 코드 품질을 향상시키는 이유",
    content: "테스트를 먼저 작성하면:\n- 요구사항을 명확히 이해\n- 작은 단위로 설계\n- 리팩토링 안전망 제공",
    tags: ["tdd", "testing", "quality"]
  });

  const microservicesNote = await createNote({
    title: "마이크로서비스의 독립적 배포 장점",
    content: "각 서비스를 독립적으로 배포할 수 있어:\n- 빠른 릴리스 사이클\n- 장애 격리\n- 기술 스택 자유도",
    tags: ["microservices", "architecture", "deployment"]
  });

  const codeReviewNote = await createNote({
    title: "효과적인 코드 리뷰 체크리스트",
    content: "리뷰 시 확인할 항목:\n- 로직 정확성\n- 에지 케이스 처리\n- 성능 고려\n- 테스트 커버리지",
    tags: ["code-review", "quality", "checklist"]
  });

  // 원자적 노트들 간의 연결
  await updateNote({
    uid: tddNote.uid,
    links: [codeReviewNote.uid] // TDD와 코드 리뷰 연결
  });

  await updateNote({
    uid: microservicesNote.uid,
    links: [tddNote.uid] // 마이크로서비스와 TDD 연결
  });
};
```

### 4.2 노트 연결 및 백링크

#### TC-4.2.1: 양방향 링크 검증
**시나리오**: 노트 간 연결이 양방향으로 추적 가능한지 확인

```typescript
const bidirectionalLinksTest = async () => {
  // 1. 허브 노트 생성 (MOC: Map of Content)
  const hubNote = await createNote({
    title: "소프트웨어 아키텍처 MOC",
    content: "# 소프트웨어 아키텍처 지식 맵",
    tags: ["moc", "architecture", "hub"]
  });

  // 2. 관련 개념 노트들 생성
  const solidNote = await createNote({
    title: "SOLID 원칙",
    content: "객체지향 설계의 5가지 원칙",
    tags: ["solid", "oop", "design-principles"],
    links: [hubNote.uid]
  });

  const cleanArchNote = await createNote({
    title: "클린 아키텍처",
    content: "의존성 역전을 통한 계층 분리",
    tags: ["clean-architecture", "layers", "dependency"],
    links: [hubNote.uid, solidNote.uid]
  });

  const dddNote = await createNote({
    title: "도메인 주도 설계",
    content: "비즈니스 도메인 중심의 설계 방법론",
    tags: ["ddd", "domain", "modeling"],
    links: [hubNote.uid, cleanArchNote.uid]
  });

  // 3. 허브 노트에 모든 링크 추가
  await updateNote({
    uid: hubNote.uid,
    content: hubNote.content + "\n\n## 연결된 개념\n- SOLID 원칙\n- 클린 아키텍처\n- 도메인 주도 설계",
    links: [solidNote.uid, cleanArchNote.uid, dddNote.uid]
  });

  // 4. 백링크 확인
  const hubWithLinks = await readNote({
    uid: hubNote.uid,
    includeLinks: true
  });

  expect(hubWithLinks.outboundLinks.length).toBe(3);
  expect(hubWithLinks.inboundLinks.length).toBe(3); // 모든 노트가 허브를 참조

  // 5. 연결된 노트 탐색
  const connectedToClean = await readNote({
    uid: cleanArchNote.uid,
    includeLinks: true
  });
  expect(connectedToClean.outboundLinks).toContain(hubNote.uid);
  expect(connectedToClean.outboundLinks).toContain(solidNote.uid);
  expect(connectedToClean.inboundLinks).toContain(dddNote.uid);
};
```

#### TC-4.2.2: 끊어진 링크 감지
**시나리오**: 삭제된 노트로의 링크를 감지

```typescript
const brokenLinksTest = async () => {
  // 1. 연결된 노트들 생성
  const noteA = await createNote({
    title: "개념 A",
    content: "기본 개념",
    tags: ["concept"]
  });

  const noteB = await createNote({
    title: "개념 B",
    content: "A를 기반으로 확장",
    tags: ["concept"],
    links: [noteA.uid]
  });

  const noteC = await createNote({
    title: "개념 C",
    content: "A와 B를 종합",
    tags: ["concept"],
    links: [noteA.uid, noteB.uid]
  });

  // 2. 노트 A 삭제
  await deleteNote({ uid: noteA.uid, confirm: true });

  // 3. 끊어진 링크 확인
  const noteBLinks = await readNote({
    uid: noteB.uid,
    includeLinks: true
  });
  expect(noteBLinks.brokenLinks).toContain(noteA.uid);

  const noteCLinks = await readNote({
    uid: noteC.uid,
    includeLinks: true
  });
  expect(noteCLinks.brokenLinks).toContain(noteA.uid);
  expect(noteCLinks.brokenLinks.length).toBe(1); // noteB는 여전히 존재
};
```

### 4.3 고아 노트 관리

#### TC-4.3.1: 연결되지 않은 노트 찾기
**시나리오**: 어떤 노트와도 연결되지 않은 고립된 노트 탐지

```typescript
const orphanNotesTest = async () => {
  // 1. 연결된 노트 네트워크
  const connectedNotes = [];
  const rootNote = await createNote({
    title: "루트 노트",
    content: "네트워크의 시작점",
    tags: ["root"]
  });

  const childNote1 = await createNote({
    title: "자식 노트 1",
    content: "루트와 연결",
    tags: ["connected"],
    links: [rootNote.uid]
  });

  const childNote2 = await createNote({
    title: "자식 노트 2",
    content: "루트와 연결",
    tags: ["connected"],
    links: [rootNote.uid]
  });

  await updateNote({
    uid: rootNote.uid,
    links: [childNote1.uid, childNote2.uid]
  });

  // 2. 고아 노트 생성 (의도적으로 연결 없이)
  const orphanNote1 = await createNote({
    title: "고립된 아이디어",
    content: "아직 분류되지 않음",
    tags: ["orphan", "unprocessed"]
  });

  const orphanNote2 = await createNote({
    title: "임시 메모",
    content: "나중에 정리 필요",
    tags: ["temp", "review-needed"]
  });

  // 3. 고아 노트 찾기 (인덱스 검색 엔진 사용)
  // 이 기능은 link-graph를 통해 구현됨
  const allOrphans = await indexSearchEngine.getOrphanNotes();
  expect(allOrphans.length).toBe(2);
  expect(allOrphans).toContain(orphanNote1.uid);
  expect(allOrphans).toContain(orphanNote2.uid);

  // 4. 고아 노트를 네트워크에 통합
  await updateNote({
    uid: rootNote.uid,
    content: rootNote.content + "\n\n## 새로 연결된 노트\n- 고립된 아이디어",
    links: [...rootNote.links, orphanNote1.uid]
  });

  // 5. 고아 노트 수 감소 확인
  const remainingOrphans = await indexSearchEngine.getOrphanNotes();
  expect(remainingOrphans.length).toBe(1);
};
```

### 4.4 Zettelkasten UID 시스템

#### TC-4.4.1: UID 고유성 및 시간순 정렬
**시나리오**: UID가 고유하고 생성 순서를 반영하는지 확인

```typescript
const uidSystemTest = async () => {
  const notes = [];

  // 빠르게 여러 노트 생성
  for (let i = 0; i < 10; i++) {
    notes.push(await createNote({
      title: `노트 ${i}`,
      content: `내용 ${i}`
    }));
  }

  // UID 고유성 확인
  const uids = notes.map(n => n.uid);
  const uniqueUids = new Set(uids);
  expect(uniqueUids.size).toBe(10);

  // UID 형식 검증 (YYYYMMDDTHHMMSSmmmmmmZ)
  for (const uid of uids) {
    expect(uid).toMatch(/^\d{8}T\d{12}Z$/);
  }

  // 시간순 정렬 가능
  const sortedByUid = [...notes].sort((a, b) => a.uid.localeCompare(b.uid));
  // 첫 번째로 생성된 것이 가장 작은 UID를 가짐
  expect(sortedByUid[0].title).toBe("노트 0");
  expect(sortedByUid[9].title).toBe("노트 9");
};
```

---

## Level 5: 전문가 - 통합 시나리오

### 5.1 PARA + Zettelkasten 복합 워크플로우

#### TC-5.1.1: 프로젝트 기반 지식 구축
**시나리오**: 실제 프로젝트를 진행하면서 Zettelkasten 방식으로 지식 축적

```typescript
const projectKnowledgeBuilding = async () => {
  // 1. 프로젝트 시작
  const projectHub = await createNote({
    title: "프로젝트: AI 추천 시스템 구축",
    content: "## 목표\n협업 필터링 기반 추천 엔진 구현\n\n## 기간\n2025-01 ~ 2025-03",
    category: "Projects",
    project: "ai-recommender",
    tags: ["ai", "machine-learning", "recommender"]
  });

  // 2. 프로젝트 중 발견한 개념들을 Zettelkasten 노트로 기록
  const conceptNotes = [];

  const collabFiltering = await createNote({
    title: "협업 필터링의 Cold Start 문제",
    content: "신규 사용자나 아이템에 대한 데이터가 없어 추천이 어려움\n\n## 해결책\n- 콘텐츠 기반 필터링 보완\n- 인기도 기반 추천\n- 사용자 프로파일링",
    category: "Resources", // 재사용 가능한 지식
    tags: ["collaborative-filtering", "cold-start", "recommender"],
    links: [projectHub.uid]
  });
  conceptNotes.push(collabFiltering);

  const matrixFactorization = await createNote({
    title: "행렬 분해를 통한 잠재 요인 추출",
    content: "사용자-아이템 행렬을 저차원 잠재 요인으로 분해\n\n## 알고리즘\n- SVD\n- ALS\n- NMF",
    category: "Resources",
    tags: ["matrix-factorization", "svd", "machine-learning"],
    links: [projectHub.uid, collabFiltering.uid]
  });
  conceptNotes.push(matrixFactorization);

  const evaluationMetrics = await createNote({
    title: "추천 시스템 평가 지표",
    content: "## 정확도\n- RMSE, MAE\n\n## 랭킹\n- Precision@K\n- Recall@K\n- NDCG\n\n## 다양성\n- Coverage\n- Novelty",
    category: "Resources",
    tags: ["evaluation", "metrics", "recommender"],
    links: [projectHub.uid]
  });
  conceptNotes.push(evaluationMetrics);

  // 3. 프로젝트 작업 노트 (실행 중심)
  const implementationNote = await createNote({
    title: "추천 엔진 구현 로그",
    content: "## 2025-01-15\n- ALS 알고리즘 선택\n- Cold Start 해결을 위해 하이브리드 방식 적용 결정",
    category: "Projects",
    project: "ai-recommender",
    tags: ["implementation", "log"],
    links: [matrixFactorization.uid, collabFiltering.uid]
  });

  // 4. 프로젝트 허브 업데이트
  await updateNote({
    uid: projectHub.uid,
    content: projectHub.content + "\n\n## 축적된 지식\n- Cold Start 문제 이해\n- 행렬 분해 기법\n- 평가 지표",
    links: [...conceptNotes.map(n => n.uid), implementationNote.uid]
  });

  // 5. 검증
  // 프로젝트 노트들
  const projectNotes = await listNotes({ project: "ai-recommender" });
  expect(projectNotes.length).toBe(2); // hub + implementation

  // 축적된 리소스들 (프로젝트와 무관하게 재사용 가능)
  const aiResources = await searchMemory({
    query: "recommender",
    category: "Resources"
  });
  expect(aiResources.length).toBe(3);

  // 링크 그래프 확인
  const hubLinks = await readNote({
    uid: projectHub.uid,
    includeLinks: true
  });
  expect(hubLinks.outboundLinks.length).toBe(4);
};
```

#### TC-5.1.2: 영역 기반 지식 관리
**시나리오**: 지속적인 책임 영역에서 Zettelkasten으로 전문성 구축

```typescript
const areaKnowledgeManagement = async () => {
  // 1. 영역 정의
  const backendArea = await createNote({
    title: "백엔드 개발 전문성",
    content: "## 핵심 역량\n- API 설계\n- 데이터베이스 최적화\n- 시스템 확장성",
    category: "Areas",
    tags: ["backend", "expertise", "ongoing"]
  });

  // 2. 영역 내 세부 지식 노트들 (Zettelkasten 스타일)
  const cachePatterns = await createNote({
    title: "캐시 전략 패턴들",
    content: "## Cache-Aside\n애플리케이션이 캐시를 직접 관리\n\n## Write-Through\n데이터 변경 시 캐시와 DB 동시 업데이트\n\n## Write-Behind\n캐시만 업데이트 후 비동기 DB 반영",
    category: "Resources",
    tags: ["caching", "patterns", "performance"],
    links: [backendArea.uid]
  });

  const indexStrategy = await createNote({
    title: "데이터베이스 인덱스 전략",
    content: "## B-Tree\n범위 쿼리에 적합\n\n## Hash\n동등 비교에 최적\n\n## Composite\n다중 컬럼 쿼리 최적화",
    category: "Resources",
    tags: ["database", "indexing", "optimization"],
    links: [backendArea.uid]
  });

  const scalingApproaches = await createNote({
    title: "수평적 vs 수직적 확장",
    content: "## 수평적 (Scale-Out)\n- 서버 추가\n- 로드 밸런싱 필요\n- 무한 확장 가능\n\n## 수직적 (Scale-Up)\n- 서버 스펙 향상\n- 한계 존재\n- 단순함",
    category: "Resources",
    tags: ["scaling", "architecture", "infrastructure"],
    links: [backendArea.uid, cachePatterns.uid]
  });

  // 3. 노트 간 크로스 링크 (개념 연결)
  await updateNote({
    uid: cachePatterns.uid,
    links: [backendArea.uid, scalingApproaches.uid] // 캐시 → 확장성
  });

  await updateNote({
    uid: indexStrategy.uid,
    links: [backendArea.uid, cachePatterns.uid] // 인덱스 → 캐시 (둘 다 성능 최적화)
  });

  // 4. 영역 허브 업데이트
  await updateNote({
    uid: backendArea.uid,
    content: backendArea.content + "\n\n## 연결된 지식\n- 캐시 전략\n- 인덱스 전략\n- 확장 방식",
    links: [cachePatterns.uid, indexStrategy.uid, scalingApproaches.uid]
  });

  // 5. 이 지식을 실제 프로젝트에서 활용
  const perfProject = await createNote({
    title: "프로젝트: API 성능 개선",
    content: "## 현재 문제\n- 응답 시간 2초\n\n## 목표\n- 200ms 이하\n\n## 적용할 지식\n- 캐시 전략\n- DB 인덱싱",
    category: "Projects",
    project: "api-performance",
    tags: ["performance", "optimization"],
    links: [cachePatterns.uid, indexStrategy.uid, scalingApproaches.uid]
  });

  // 6. 검증: 지식이 다양한 컨텍스트에서 활용됨
  const cacheBacklinks = await readNote({
    uid: cachePatterns.uid,
    includeLinks: true
  });
  expect(cacheBacklinks.inboundLinks.length).toBeGreaterThanOrEqual(2);
  // backendArea와 perfProject에서 참조됨
};
```

### 5.2 실제 사용 시뮬레이션

#### TC-5.2.1: AI 에이전트의 메모리 구축
**시나리오**: AI 에이전트가 대화를 통해 지식을 축적

```typescript
const aiAgentMemorySimulation = async () => {
  // 시뮬레이션: AI 에이전트가 사용자와 대화하며 메모리 구축

  // Session 1: 사용자가 React에 대해 질문
  const reactBasics = await createNote({
    title: "사용자 질문: React 컴포넌트 생명주기",
    content: "## 대화 요약\n사용자가 React 클래스 컴포넌트의 생명주기를 물음\n\n## 제공한 답변\n- componentDidMount: 마운트 후\n- componentDidUpdate: 업데이트 후\n- componentWillUnmount: 언마운트 전",
    category: "Areas", // 사용자 지원 영역
    tags: ["react", "conversation", "user-support"]
  });

  // Session 2: 같은 사용자가 Hooks에 대해 질문
  const reactHooks = await createNote({
    title: "사용자 질문: useEffect와 생명주기 비교",
    content: "## 대화 요약\n이전 대화를 이어서 Hooks 방식 질문\n\n## 연결\nuseEffect = componentDidMount + componentDidUpdate + componentWillUnmount",
    category: "Areas",
    tags: ["react", "hooks", "conversation"],
    links: [reactBasics.uid] // 이전 대화와 연결
  });

  // Session 3: 성능 문제 논의
  const reactPerf = await createNote({
    title: "사용자 프로젝트: React 리렌더링 최적화",
    content: "## 문제\n불필요한 리렌더링으로 성능 저하\n\n## 제안한 해결책\n- React.memo 사용\n- useMemo/useCallback\n- 상태 구조 개선",
    category: "Projects",
    project: "user-react-optimization",
    tags: ["react", "performance", "optimization"],
    links: [reactBasics.uid, reactHooks.uid]
  });

  // 지식 검색 (이전 대화 참조)
  const reactKnowledge = await searchMemory({
    query: "React 생명주기"
  });
  expect(reactKnowledge.length).toBeGreaterThan(0);

  // 관련 노트 추천 (연결된 노트 탐색)
  const relatedToHooks = await readNote({
    uid: reactHooks.uid,
    includeLinks: true
  });
  expect(relatedToHooks.outboundLinks).toContain(reactBasics.uid);
  expect(relatedToHooks.inboundLinks).toContain(reactPerf.uid);
};
```

#### TC-5.2.2: 점진적 정교화 (Progressive Summarization)
**시나리오**: 노트를 반복적으로 다듬어 핵심 지식 추출

```typescript
const progressiveSummarization = async () => {
  // Layer 1: 원본 자료 캡처
  const originalNote = await createNote({
    title: "강의 노트: 분산 시스템 기초",
    content: `# 분산 시스템 강의

많은 내용이 있었지만 핵심은...

## CAP 정리
분산 시스템은 Consistency, Availability, Partition Tolerance 중
최대 2개만 동시에 보장할 수 있다.

네트워크 파티션은 불가피하므로 실제로는 CP 또는 AP 중 선택해야 한다.

## 일관성 모델
- Strong Consistency: 모든 읽기가 최신 쓰기를 반영
- Eventual Consistency: 시간이 지나면 결국 일관됨
- Causal Consistency: 인과 관계가 있는 연산만 순서 보장`,
    category: "Resources",
    tags: ["distributed-systems", "lecture", "raw"]
  });

  // Layer 2: 핵심 하이라이트 (요약본 생성)
  const summaryNote = await createNote({
    title: "핵심: 분산 시스템 설계 선택",
    content: `## CAP Trade-off
**CP 선택**: 일관성 우선 (금융 시스템)
**AP 선택**: 가용성 우선 (소셜 미디어)

## 일관성 스펙트럼
Strong → Causal → Eventual
성능↓, 복잡도↑ | 균형 | 성능↑, 간단↓`,
    category: "Resources",
    tags: ["distributed-systems", "summary", "decision"],
    links: [originalNote.uid]
  });

  // Layer 3: 실행 가능한 통찰
  const insightNote = await createNote({
    title: "통찰: 내 프로젝트의 CAP 선택 가이드",
    content: `## 우리 시스템 분석
- 금융 데이터 처리 → **CP 필수**
- 사용자 피드 → AP 가능
- 세션 관리 → Causal 충분

## 액션 아이템
1. 트랜잭션 서비스: PostgreSQL + 동기 복제
2. 피드 서비스: Cassandra + 비동기 복제
3. 세션: Redis Cluster`,
    category: "Projects",
    project: "system-architecture",
    tags: ["architecture", "decision", "actionable"],
    links: [summaryNote.uid, originalNote.uid]
  });

  // 검증: 지식이 단계별로 정제됨
  const rawNotes = await searchMemory({ query: "분산 시스템", tags: ["raw"] });
  const summaries = await searchMemory({ query: "분산 시스템", tags: ["summary"] });
  const insights = await searchMemory({ query: "분산 시스템", tags: ["actionable"] });

  // 각 단계가 이전 단계를 참조
  const insightLinks = await readNote({
    uid: insightNote.uid,
    includeLinks: true
  });
  expect(insightLinks.outboundLinks).toContain(summaryNote.uid);
  expect(insightLinks.outboundLinks).toContain(originalNote.uid);
};
```

---

## Level 6: 스트레스 및 엣지 케이스

### 6.1 대규모 데이터 처리

#### TC-6.1.1: 1000개 노트 성능 테스트
```typescript
const largeScaleTest = async () => {
  const startTime = Date.now();
  const notes = [];

  // 1. 1000개 노트 생성 (다양한 카테고리와 태그)
  for (let i = 0; i < 1000; i++) {
    const categories = ['Projects', 'Areas', 'Resources', 'Archives'];
    const tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];

    const note = await createNote({
      title: `대규모 테스트 노트 ${i}`,
      content: `이것은 노트 ${i}의 내용입니다. Lorem ipsum dolor sit amet.`,
      category: categories[i % 4],
      tags: [tags[i % 5], tags[(i + 1) % 5]],
      links: notes.length > 0 ? [notes[Math.floor(Math.random() * notes.length)].uid] : []
    });
    notes.push(note);
  }

  const creationTime = Date.now() - startTime;
  console.log(`1000 notes creation time: ${creationTime}ms`);

  // 2. 검색 성능 테스트 (P95 < 120ms 목표)
  const searchTimes = [];
  for (let i = 0; i < 100; i++) {
    const searchStart = Date.now();
    await searchMemory({ query: "대규모" });
    searchTimes.push(Date.now() - searchStart);
  }

  searchTimes.sort((a, b) => a - b);
  const p95Latency = searchTimes[Math.floor(searchTimes.length * 0.95)];
  expect(p95Latency).toBeLessThan(120);

  // 3. 목록 조회 성능
  const listStart = Date.now();
  await listNotes({ limit: 100, offset: 0 });
  const listTime = Date.now() - listStart;
  expect(listTime).toBeLessThan(500);

  // 4. 복잡한 필터링
  const filterStart = Date.now();
  await listNotes({
    category: 'Resources',
    tags: ['tag1', 'tag2'],
    sortBy: 'title',
    sortOrder: 'asc',
    limit: 50
  });
  const filterTime = Date.now() - filterStart;
  expect(filterTime).toBeLessThan(500);
};
```

### 6.2 동시성 및 경쟁 조건

#### TC-6.2.1: 동시 쓰기 테스트
```typescript
const concurrentWriteTest = async () => {
  // 동일 노트를 동시에 수정 시도
  const note = await createNote({
    title: "동시성 테스트",
    content: "초기 내용",
    tags: []
  });

  // 병렬로 여러 업데이트 실행
  const updates = [];
  for (let i = 0; i < 10; i++) {
    updates.push(updateNote({
      uid: note.uid,
      content: `업데이트 ${i}`,
      tags: [`tag${i}`]
    }));
  }

  // 모든 업데이트가 성공하거나 적절한 오류 반환
  const results = await Promise.allSettled(updates);
  const successes = results.filter(r => r.status === 'fulfilled');

  // 최소한 일부는 성공해야 함
  expect(successes.length).toBeGreaterThan(0);

  // 최종 상태 확인 (일관성 유지)
  const finalNote = await readNote({ uid: note.uid });
  expect(finalNote.content).toBeDefined();
};
```

### 6.3 엣지 케이스

#### TC-6.3.1: 특수 문자 및 유니코드
```typescript
const specialCharactersTest = async () => {
  // 다양한 특수 문자가 포함된 노트
  const unicodeNote = await createNote({
    title: "한글/日本語/العربية 테스트 🚀",
    content: `## 특수 문자들
- 이모지: 🎉🔥💡
- 수학: ∑∫∂∆
- 기호: ©®™
- 화살표: →←↑↓
- 따옴표: "quotes" 'single' «guillemets»`,
    tags: ["unicode", "special-chars", "한글"]
  });

  // 저장 후 읽기
  const read = await readNote({ uid: unicodeNote.uid });
  expect(read.title).toContain("한글");
  expect(read.content).toContain("🚀");

  // 검색
  const searchResult = await searchMemory({ query: "한글" });
  expect(searchResult.length).toBeGreaterThan(0);
};
```

#### TC-6.3.2: 매우 긴 콘텐츠
```typescript
const longContentTest = async () => {
  // 10만 자 이상의 긴 노트
  const longContent = "Lorem ipsum ".repeat(10000);

  const longNote = await createNote({
    title: "매우 긴 노트",
    content: longContent
  });

  // 저장 및 읽기 성공
  const read = await readNote({ uid: longNote.uid });
  expect(read.content.length).toBe(longContent.length);

  // 메타데이터 확인
  const metadata = await readNote({
    uid: longNote.uid,
    includeMetadata: true
  });
  expect(metadata.wordCount).toBeGreaterThan(10000);
};
```

#### TC-6.3.3: 순환 링크
```typescript
const circularLinksTest = async () => {
  // A → B → C → A 순환 구조
  const noteA = await createNote({
    title: "노트 A",
    content: "A",
    tags: ["circular"]
  });

  const noteB = await createNote({
    title: "노트 B",
    content: "B",
    tags: ["circular"],
    links: [noteA.uid]
  });

  const noteC = await createNote({
    title: "노트 C",
    content: "C",
    tags: ["circular"],
    links: [noteB.uid]
  });

  // 순환 완성: A → C
  await updateNote({
    uid: noteA.uid,
    links: [noteC.uid]
  });

  // 순환 링크가 있어도 시스템이 안정적으로 동작
  const noteALinks = await readNote({
    uid: noteA.uid,
    includeLinks: true
  });
  expect(noteALinks.outboundLinks).toContain(noteC.uid);

  // 연결된 노트 그래프 탐색이 무한 루프에 빠지지 않음
  const connectedNotes = await indexSearchEngine.getConnectedNotes(noteA.uid);
  expect(connectedNotes.length).toBe(3); // A, B, C
};
```

---

## 검증 체크리스트

### 기본 기능 검증
- [ ] 모든 CRUD 작업 정상 동작
- [ ] 입력 유효성 검사 작동
- [ ] 에러 메시지가 명확함
- [ ] UID 고유성 보장

### PARA 방법론 검증
- [ ] 4개 카테고리 분류 정확함
- [ ] 카테고리별 필터링 동작
- [ ] 프로젝트 연결 기능 동작
- [ ] 카테고리 간 이동 (예: Projects → Archives)

### Zettelkasten 방법론 검증
- [ ] UID 기반 고유 식별 동작
- [ ] 양방향 링크 추적 가능
- [ ] 백링크 자동 생성/갱신
- [ ] 고아 노트 탐지 기능
- [ ] 끊어진 링크 감지

### 성능 검증
- [ ] 검색 P95 latency < 120ms (10k 노트 기준)
- [ ] 증분 인덱싱 < 3초
- [ ] 대규모 데이터 처리 안정성

### 통합 검증
- [ ] PARA + Zettelkasten 혼용 가능
- [ ] 복잡한 링크 그래프 처리
- [ ] 다국어 및 특수문자 지원
- [ ] 동시성 안전

---

## 테스트 실행 가이드

```bash
# 전체 테스트 실행
npm test

# 특정 레벨만 실행
npm test -- --grep "Level 1"
npm test -- --grep "Level 3"

# 성능 테스트 (긴 타임아웃 필요)
npm run test:performance

# E2E MCP 프로토콜 테스트
npm run test:e2e

# 커버리지 확인
npm run test:coverage
```

---

## 다음 단계

1. **기본 시나리오 구현**: Level 1-2 자동화 테스트 작성
2. **PARA 검증 테스트**: Level 3 시나리오 구현
3. **Zettelkasten 검증 테스트**: Level 4 시나리오 구현
4. **통합 테스트**: Level 5 복합 시나리오 구현
5. **스트레스 테스트**: Level 6 성능 및 엣지 케이스

이 문서는 MCP 서버가 PARA 메모법과 Zettelkasten 메모법을 올바르게 지원하는지 체계적으로 검증하기 위한 포괄적인 가이드입니다.
