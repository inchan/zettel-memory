# SDD + TDD Integrated Workflow

ai-cli-syncer 프로젝트의 **Specification-Driven Development (SDD)**와 **Test-Driven Development (TDD)** 통합 워크플로우입니다.

---

## 목차

1. [개요](#개요)
2. [워크플로우 다이어그램](#워크플로우-다이어그램)
3. [Phase 1: Specification (스펙 작성)](#phase-1-specification-스펙-작성)
4. [Phase 2: Test Definition (테스트 정의)](#phase-2-test-definition-테스트-정의)
5. [Phase 3: TDD Implementation (TDD 구현)](#phase-3-tdd-implementation-tdd-구현)
6. [Phase 4: Verification (검증)](#phase-4-verification-검증)
7. [Phase 5: Iteration (반복)](#phase-5-iteration-반복)
8. [실전 예제](#실전-예제)
9. [AI 에이전트 협업](#ai-에이전트-협업)
10. [체크리스트](#체크리스트)

---

## 개요

### SDD + TDD = Spec → Test → Code (STC)

```
스펙 작성 → 테스트 정의 → TDD 구현 → 검증 → 반복
   (RFC/ADR)    (테스트 케이스)  (Red-Green-Refactor)
```

### 핵심 원칙

1. **Spec First**: 구현 전에 명확한 스펙 정의
2. **Test From Spec**: 스펙에서 테스트 케이스 도출
3. **TDD Cycle**: Red-Green-Refactor 적용
4. **Validate Against Spec**: 구현이 스펙을 준수하는지 검증
5. **Iterate**: 필요 시 스펙 업데이트 및 반복

### 언제 이 워크플로우를 사용하는가?

| 작업 유형 | 워크플로우 |
|----------|-----------|
| 복잡한 새 기능 | ✅ Full SDD+TDD |
| 간단한 새 기능 | ⚠️ TDD만 (RFC 생략) |
| 기술 선택 | ✅ ADR + TDD |
| 버그 수정 | ⚠️ TDD만 |
| 리팩토링 (대규모) | ✅ RFC + TDD |
| 리팩토링 (소규모) | ⚠️ TDD만 |

---

## 워크플로우 다이어그램

```
┌──────────────────────────────────────────────────────────────┐
│                   SDD + TDD Workflow                         │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ 1. Spec 작성    │  RFC/ADR 작성
│   (RFC/ADR)     │  • 무엇을 만들 것인가?
└────────┬────────┘  • 왜 필요한가?
         │           • 어떻게 작동할 것인가?
         ↓
┌─────────────────┐
│ 2. 테스트 정의  │  스펙 기반 테스트 케이스
│                 │  • 단위 테스트 시나리오
└────────┬────────┘  • 통합 테스트 시나리오
         │           • Acceptance Criteria
         ↓
┌─────────────────┐
│ 3. TDD 구현     │  Red-Green-Refactor
│                 │  ┌──────────────────┐
│                 │  │ Red: 실패 테스트 │
│                 │  └────────┬─────────┘
│                 │           ↓
│                 │  ┌──────────────────┐
│                 │  │ Green: 최소 구현 │
│                 │  └────────┬─────────┘
│                 │           ↓
│                 │  ┌──────────────────┐
│                 │  │ Refactor: 개선   │
└────────┬────────┘  └──────────────────┘
         │
         ↓
┌─────────────────┐
│ 4. 검증         │  스펙 준수 확인
│                 │  • 모든 테스트 통과?
└────────┬────────┘  • 스펙 요구사항 충족?
         │           • 코드 품질 OK?
         ↓
    ┌─────────┐
    │ 완료?   │ ──No──> 5. 반복 ──┐
    └────┬────┘                    │
         │                         │
        Yes                        │
         │                         │
         ↓                         │
    ┌─────────┐                    │
    │ Release │ <──────────────────┘
    └─────────┘
```

---

## Phase 1: Specification (스펙 작성)

### 목표
무엇을 만들 것인지, 왜 필요한지 명확히 정의합니다.

### 단계

#### 1.1 RFC 또는 ADR 결정

**RFC를 작성하는 경우**:
- 새로운 기능이나 모듈
- 사용자에게 영향을 주는 변경
- 복잡한 리팩토링

**ADR를 작성하는 경우**:
- 기술 스택 선택
- 아키텍처 패턴 결정
- 데이터 형식 결정

#### 1.2 템플릿 복사 및 작성

```bash
# RFC 작성
cp docs/specs/rfcs/0000-template.md docs/specs/rfcs/NNNN-feature-name.md

# ADR 작성
cp docs/specs/adrs/0000-template.md docs/specs/adrs/NNNN-decision-title.md
```

#### 1.3 핵심 섹션 작성

**RFC 필수 섹션**:
- ✅ Summary: 한 단락 요약
- ✅ Motivation: 문제 정의 및 목표
- ✅ Technical Design: 구현 설계
- ✅ Test Strategy: 테스트 계획

**ADR 필수 섹션**:
- ✅ Context: 배경과 문제
- ✅ Considered Options: 고려한 옵션들 (2-4개)
- ✅ Decision Outcome: 선택과 이유
- ✅ Consequences: 긍정/부정적 영향

#### 1.4 리뷰 및 피드백

```bash
# AI 에이전트와 리뷰 (Claude Code)
$ claude review docs/specs/rfcs/0001-feature.md

# 또는 팀원에게 공유
```

### 산출물
- [ ] RFC 또는 ADR 문서 (Draft 상태)
- [ ] 미해결 질문 목록 (있다면)

---

## Phase 2: Test Definition (테스트 정의)

### 목표
스펙에서 테스트 케이스를 도출하여 명확한 성공 기준을 정의합니다.

### 단계

#### 2.1 Acceptance Criteria 정의

RFC의 **Test Strategy** 섹션을 기반으로 Acceptance Criteria를 명확히 합니다.

**예시 (CLI 기능)**:
```
Given: 사용자가 `ai-cli-syncer init` 실행
When: 현재 디렉토리에 설정 파일이 없을 때
Then:
  - `.ai-syncer/config.toml` 생성
  - 성공 메시지 출력
  - Exit code 0
```

#### 2.2 테스트 케이스 도출

**단위 테스트 케이스**:
```rust
// RFC에서 도출된 테스트 케이스

#[test]
fn test_init_creates_config_file() {
    // Given
    let temp_dir = TempDir::new().unwrap();

    // When
    let result = init_command(&temp_dir.path());

    // Then
    assert!(result.is_ok());
    assert!(temp_dir.path().join(".ai-syncer/config.toml").exists());
}

#[test]
fn test_init_fails_if_already_initialized() {
    // ...
}
```

**통합 테스트 케이스**:
```rust
#[test]
fn test_full_workflow_init_and_sync() {
    // Given
    // When
    // Then
}
```

#### 2.3 테스트 시나리오 문서화

테스트 시나리오를 RFC의 **Test Strategy** 섹션에 추가하거나, 별도 파일로 작성합니다.

```markdown
## Test Scenarios

### Scenario 1: Happy Path
1. init → 성공
2. sync → 성공
3. status → 모든 에이전트 synced

### Scenario 2: Error Handling
1. init → 이미 초기화됨 → 에러
2. sync (without init) → 에러

### Scenario 3: Edge Cases
1. init → 권한 없음 → 에러
2. sync → 대상 파일 읽기 전용 → 경고
```

### 산출물
- [ ] Acceptance Criteria 목록
- [ ] 단위 테스트 케이스 목록
- [ ] 통합 테스트 시나리오

---

## Phase 3: TDD Implementation (TDD 구현)

### 목표
Red-Green-Refactor 사이클로 테스트를 먼저 작성하고 구현합니다.

### 단계

#### 3.1 Red: 실패하는 테스트 작성

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_command_executes_successfully() {
        // Arrange
        let config = create_test_config();
        let sync_cmd = SyncCommand::new(config);

        // Act
        let result = sync_cmd.execute();

        // Assert
        assert!(result.is_ok());
        // 이 시점에는 구현이 없으므로 테스트 실패
    }
}
```

```bash
$ cargo test
# 실패 확인 (Red)
```

#### 3.2 Green: 최소 구현

```rust
impl SyncCommand {
    pub fn execute(&self) -> Result<()> {
        // 테스트를 통과시키는 최소한의 구현
        Ok(())
    }
}
```

```bash
$ cargo test
# 성공 확인 (Green)
```

#### 3.3 Refactor: 코드 개선

```rust
impl SyncCommand {
    pub fn execute(&self) -> Result<()> {
        // 실제 로직 구현 및 리팩토링
        self.validate_config()?;
        self.sync_files()?;
        Ok(())
    }

    fn validate_config(&self) -> Result<()> {
        // ...
    }

    fn sync_files(&self) -> Result<()> {
        // ...
    }
}
```

```bash
$ cargo test
# 여전히 성공 확인 (Refactor 완료)
```

#### 3.4 반복

각 기능/메서드에 대해 Red-Green-Refactor 사이클을 반복합니다.

### 산출물
- [ ] 통과하는 단위 테스트
- [ ] 통과하는 통합 테스트
- [ ] 리팩토링된 코드

---

## Phase 4: Verification (검증)

### 목표
구현이 스펙을 준수하고 품질 기준을 충족하는지 검증합니다.

### 단계

#### 4.1 테스트 커버리지 확인

```bash
$ cargo tarpaulin --out Html
# 커버리지 리포트 확인
```

**목표**: 80% 이상 커버리지

#### 4.2 스펙 준수 검증

RFC/ADR과 실제 구현을 비교합니다:

```markdown
## Verification Checklist

- [ ] Summary에 명시된 기능이 모두 구현되었는가?
- [ ] Technical Design의 인터페이스와 실제 코드가 일치하는가?
- [ ] Test Strategy의 모든 시나리오가 테스트되었는가?
- [ ] Acceptance Criteria가 모두 충족되었는가?
```

#### 4.3 코드 리뷰

```bash
# AI 에이전트와 코드 리뷰
$ claude review src/commands/sync.rs --spec docs/specs/rfcs/0001-cli-interface.md
```

#### 4.4 수동 테스트

```bash
# 실제 CLI로 테스트
$ cargo run -- init
$ cargo run -- sync
$ cargo run -- status
```

### 산출물
- [ ] 테스트 커버리지 리포트 (80%+)
- [ ] 스펙 준수 확인서 (체크리스트)
- [ ] 코드 리뷰 완료

---

## Phase 5: Iteration (반복)

### 목표
피드백을 반영하고 필요 시 스펙을 업데이트합니다.

### 단계

#### 5.1 피드백 수집

- 팀원 피드백
- AI 에이전트 리뷰 결과
- 수동 테스트 결과
- 사용자 피드백 (릴리스 후)

#### 5.2 스펙 업데이트

구현 중 발견한 사항을 RFC/ADR에 반영합니다:

```markdown
## Implementation Notes (Added 2025-01-06)

구현 중 다음 사항이 변경되었습니다:
- Original: TOML 형식으로 설정 저장
- Updated: JSON 형식으로 변경 (이유: MCP 서버와 호환성)
- Related: [ADR-0003: Use JSON for Config](../adrs/0003-use-json.md)
```

#### 5.3 테스트 업데이트

스펙 변경에 따라 테스트도 업데이트합니다.

#### 5.4 재검증

Phase 4 (Verification)를 다시 수행합니다.

### 산출물
- [ ] 업데이트된 RFC/ADR
- [ ] 업데이트된 테스트
- [ ] 재검증 완료

---

## 실전 예제

### 예제: CLI `sync` 명령어 구현

#### Step 1: RFC 작성

```markdown
# RFC 0001: CLI Interface Design

## Technical Design

### Component: `sync` Command

```rust
pub struct SyncCommand {
    pub agent: Option<String>,
    pub dry_run: bool,
}

impl CommandHandler for SyncCommand {
    fn execute(&self) -> Result<()>;
}
```

## Test Strategy

- `test_sync_all_agents`: 모든 에이전트 동기화
- `test_sync_specific_agent`: 특정 에이전트만 동기화
- `test_sync_dry_run`: dry-run 모드
```

#### Step 2: 테스트 정의

```rust
// tests/integration/sync_test.rs

#[test]
fn test_sync_all_agents() {
    // Acceptance Criteria:
    // - 모든 설정 파일이 각 에이전트에 복사됨
    // - 성공 메시지 출력
    // - Exit code 0

    // Given
    let config = create_test_config_with_multiple_agents();
    let sync_cmd = SyncCommand {
        agent: None,
        dry_run: false,
    };

    // When
    let result = sync_cmd.execute();

    // Then
    assert!(result.is_ok());
    assert_file_synced("CLAUDE.md", "~/.config/claude/CLAUDE.md");
    assert_file_synced(".cursorrules", ".cursorrules");
}
```

#### Step 3: TDD 구현

**Red**:
```bash
$ cargo test test_sync_all_agents
# 실패 (구현 없음)
```

**Green**:
```rust
impl CommandHandler for SyncCommand {
    fn execute(&self) -> Result<()> {
        // 최소 구현
        Ok(())
    }
}

$ cargo test test_sync_all_agents
# 통과 (하지만 실제 동기화는 안 됨)
```

**Refactor**:
```rust
impl CommandHandler for SyncCommand {
    fn execute(&self) -> Result<()> {
        let config = ConfigManager::load()?;
        let agents = self.filter_agents(&config)?;

        for agent in agents {
            self.sync_to_agent(&agent)?;
        }

        println!("Sync completed: {} files updated", agents.len());
        Ok(())
    }

    fn filter_agents(&self, config: &Config) -> Result<Vec<Agent>> {
        // ...
    }

    fn sync_to_agent(&self, agent: &Agent) -> Result<()> {
        // ...
    }
}
```

#### Step 4: 검증

```bash
# 테스트 실행
$ cargo test

# 커버리지 확인
$ cargo tarpaulin

# 수동 테스트
$ cargo run -- sync
✓ CLAUDE.md → ~/.config/claude/CLAUDE.md
✓ .cursorrules → .cursorrules
Sync completed: 2 files updated
```

#### Step 5: 스펙 업데이트

```markdown
# RFC 0001: CLI Interface Design

...

## Implementation Status

- **Status**: Implemented (2025-01-06)
- **Changes from Spec**: None
- **Test Coverage**: 85%
```

---

## AI 에이전트 협업

### Claude Code와 함께 SDD+TDD 수행

#### 1. RFC 작성 요청

```
Claude, RFC 0001 (CLI Interface)를 기반으로 `sync` 명령어를 구현해줘.
먼저 테스트 케이스를 작성하고, TDD로 구현해줘.
```

#### 2. Claude가 수행하는 작업

1. RFC 읽기 및 이해
2. 테스트 케이스 작성 (Red)
3. 최소 구현 (Green)
4. 리팩토링 (Refactor)
5. 스펙 준수 확인

#### 3. 리뷰 및 피드백

```
Claude, 이 구현이 RFC 0001의 Test Strategy를 모두 만족하는지 확인해줘.
```

---

## 체크리스트

### 기능 개발 시 체크리스트

#### Phase 1: Specification
- [ ] RFC 또는 ADR 작성 완료
- [ ] Summary, Motivation, Technical Design 명확
- [ ] Test Strategy 정의
- [ ] 리뷰 및 피드백 반영

#### Phase 2: Test Definition
- [ ] Acceptance Criteria 정의
- [ ] 단위 테스트 케이스 목록 작성
- [ ] 통합 테스트 시나리오 작성

#### Phase 3: TDD Implementation
- [ ] 각 기능에 대해 Red-Green-Refactor 수행
- [ ] 모든 테스트 통과
- [ ] 코드 리팩토링 완료

#### Phase 4: Verification
- [ ] 테스트 커버리지 80% 이상
- [ ] 스펙 준수 확인 (체크리스트)
- [ ] 코드 리뷰 완료
- [ ] 수동 테스트 완료

#### Phase 5: Iteration
- [ ] 피드백 반영
- [ ] 필요 시 스펙 업데이트
- [ ] 재검증 완료

#### 완료
- [ ] RFC/ADR 상태를 `Implemented`로 변경
- [ ] 문서 업데이트 (README, CHANGELOG 등)
- [ ] PR 생성 및 병합

---

## 관련 문서

- [Specifications README](../specs/README.md) - RFC/ADR 작성 가이드
- [DEVELOPMENT_GUIDELINES.md](../DEVELOPMENT_GUIDELINES.md) - TDD 원칙
- [ARCHITECTURE.md](../ARCHITECTURE.md) - 시스템 아키텍처

---

**이 워크플로우에 대한 질문이나 개선 제안이 있으면 이슈를 등록해주세요.**
