# Glossary

> Memory MCP 프로젝트에서 사용되는 주요 용어 정의

---

## 🔤 Core Concepts

### Memory MCP
**Memory MCP** (Model Context Protocol Server)는 로컬 Markdown 기반 지식 관리 시스템을 MCP 프로토콜을 통해 AI 에이전트에게 노출하는 서버입니다.

### MCP (Model Context Protocol)
AI 모델과 외부 데이터 소스를 연결하는 표준 프로토콜입니다. Claude Desktop 등 MCP 호환 클라이언트와 통합됩니다.

**참고**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

---

## 📝 Note Management

### Zettelkasten
독일어로 "슬립 박스"를 의미하며, UID 기반으로 노트를 연결하는 지식 관리 방법론입니다.

**핵심 원칙**:
- 각 노트는 고유 ID (UID) 보유
- 노트 간 양방향 링크
- 원자적 개념 (하나의 노트 = 하나의 아이디어)

**참고**: [zettelkasten.de](https://zettelkasten.de/)

### PARA Method
노트를 4가지 카테고리로 분류하는 조직 방법론입니다:

- **Projects**: 명확한 목표와 마감일이 있는 작업
- **Areas**: 지속적으로 관리해야 하는 영역
- **Resources**: 참고 자료 및 지식
- **Archives**: 완료되거나 비활성화된 항목

**참고**: [Tiago Forte - PARA Method](https://fortelabs.com/blog/para/)

### UID (Unique Identifier)
각 노트의 고유 식별자입니다. 타임스탬프 기반으로 생성됩니다.

**형식**: `20250120T123045678901Z` (ISO 8601 기반)

### Front Matter
Markdown 파일 상단의 YAML 메타데이터 블록입니다.

**예시**:
```yaml
---
id: "20250120T123045Z"
title: "My Note"
category: "Resources"
tags: ["learning", "ai"]
created: "2025-01-20T12:30:45Z"
updated: "2025-01-20T12:30:45Z"
links: []
---
```

---

## 🔍 Search & Indexing

### FTS5 (Full-Text Search 5)
SQLite의 전문 검색 확장 기능입니다. BM25 랭킹 알고리즘을 지원합니다.

**특징**:
- 빠른 키워드 검색
- 불용어 제거
- 형태소 분석 (tokenizer)

**참고**: [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)

### BM25 (Best Matching 25)
정보 검색에서 사용되는 랭킹 알고리즘입니다. TF-IDF의 확률론적 변형입니다.

**고려 요소**:
- Term Frequency (TF): 문서 내 키워드 빈도
- Inverse Document Frequency (IDF): 전체 문서에서의 희소성
- Document Length: 문서 길이 정규화

### Incremental Indexing
파일 변경 시 전체 인덱스를 재구축하지 않고, 변경된 부분만 업데이트하는 방식입니다.

**장점**:
- 빠른 인덱싱 속도 (< 3초)
- 리소스 효율성

---

## 🤖 AI Integration

### Ollama
⚠️ **Ollama와 Olima를 혼동하지 마세요!**

**Ollama**는 로컬에서 LLM을 실행할 수 있는 오픈소스 플랫폼입니다.

**특징**:
- 로컬 실행 (프라이버시 보장)
- 다양한 모델 지원 (Llama, Mistral 등)
- REST API 제공

**사용처**: `organize_notes` 도구에서 노트 정리 제안

**참고**: [ollama.ai](https://ollama.ai/)

### Olima (Planned Feature)
⚠️ **v1.0.0+ 계획된 기능**

**Olima**는 이 프로젝트에서 계획 중인 **문맥 인식 랭킹 엔진**입니다.

**계획된 기능**:
- 벡터 임베딩 기반 유사도 검색
- 세션 문맥 기반 리랭킹
- 자동 링크 제안

**현재 상태**: 미구현 (assoc-engine 패키지는 스텁)

---

## 🛠️ Technical Terms

### Atomic Write
파일 쓰기 작업을 원자적으로 수행하여 데이터 손실을 방지하는 기법입니다.

**구현**:
1. 임시 파일에 쓰기 (`note.tmp`)
2. `fsync()` 호출 (디스크 동기화)
3. `rename()` 호출 (원자적 이동)

**장점**: 쓰기 중 충돌/중단 시에도 데이터 무결성 보장

### Discriminated Union
TypeScript의 타입 안전성을 높이는 패턴입니다. 공통 필드(discriminant)로 타입을 구분합니다.

**예시**:
```typescript
type Action =
  | { type: "tag"; value: string }
  | { type: "archive" };

// TypeScript가 type 필드로 자동 타입 추론
function handle(action: Action) {
  if (action.type === "tag") {
    console.log(action.value); // OK
  }
}
```

### Zod
TypeScript용 스키마 선언 및 검증 라이브러리입니다.

**특징**:
- 런타임 타입 검증
- 타입 추론 (`z.infer<>`)
- 상세한 에러 메시지

**사용처**: MCP 도구 입력 검증, Ollama 응답 검증

### WAL Mode (Write-Ahead Logging)
SQLite의 동시성 향상 모드입니다.

**장점**:
- 읽기와 쓰기 동시 수행 가능
- 더 나은 성능

**단점**: 추가 파일 생성 (`.db-wal`, `.db-shm`)

---

## 📊 Metrics & Monitoring

### P95 (95th Percentile)
성능 지표에서 상위 5%를 제외한 95%의 요청이 완료되는 시간입니다.

**예시**: P95 < 120ms → 95%의 검색이 120ms 이내 완료

**장점**: 평균보다 실제 사용자 경험을 잘 반영

### KPI (Key Performance Indicator)
프로젝트의 성공을 측정하는 핵심 지표입니다.

**Memory MCP KPI**:
- 검색 P95 < 120ms
- 증분 인덱싱 < 3초
- 전체 인덱싱 (1만 노트) < 5분
- 데이터 손실 0
- 민감정보 마스킹 정탐율 > 95%

---

## 🔄 Development Concepts

### TDD (Test-Driven Development)
테스트를 먼저 작성하고 코드를 구현하는 개발 방법론입니다.

**사이클**:
1. **Red**: 실패하는 테스트 작성
2. **Green**: 최소한의 코드로 테스트 통과
3. **Refactor**: 코드 개선

### SDD (Specification-Driven Development)
명세(RFC/ADR)를 먼저 작성하고 개발하는 방법론입니다.

**워크플로우**:
1. Spec 작성 (RFC/ADR)
2. Test 작성 (from spec)
3. Code 구현 (TDD)
4. Review (against spec)

### RFC (Request for Comments)
새로운 기능이나 변경사항을 제안하는 문서입니다.

**용도**: 새 기능, API 변경, 복잡한 리팩토링

### ADR (Architecture Decision Record)
기술적 결정을 기록하는 문서입니다.

**용도**: 기술 스택 선택, 아키텍처 패턴, 트레이드오프 결정

---

## 🔐 Security Terms

### Sensitive Information Masking
민감한 정보를 자동으로 감지하고 마스킹하는 기능입니다.

**대상**:
- 이메일 주소
- 전화번호
- 주민등록번호
- 신용카드 번호

**방법**: 정규식 기반 패턴 매칭

### Local-First
데이터를 클라우드가 아닌 로컬에 우선 저장하는 철학입니다.

**장점**:
- 프라이버시 보장
- 오프라인 작동
- 빠른 응답 속도

---

## 📚 Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처
- [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) - 기술 명세
- [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md) - 개발 가이드

---

**Last Updated**: 2025-11-20  
**Version**: v0.0.1
