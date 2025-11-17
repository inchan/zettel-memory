#!/usr/bin/env node

/**
 * 복잡한 시나리오 검증 테스트 - 사용자 레벨
 *
 * 이 스크립트는 실제 프로젝트에서 발생하는 복잡한 데이터를 입력하고
 * 특정 이슈를 검색하는 시나리오를 테스트합니다.
 *
 * 사용법:
 *   npx tsx scripts/user-scenario-test.ts --vault ~/my-vault --index ~/my-index.db
 *   # 또는
 *   node dist/scripts/user-scenario-test.js --vault ~/my-vault --index ~/my-index.db
 */

import { executeTool } from '../packages/mcp-server/src/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 간단한 로거
function createSimpleLogger() {
  return {
    debug: (..._args: unknown[]) => {},
    info: (..._args: unknown[]) => {},
    warn: (..._args: unknown[]) => {},
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  };
}

// CLI 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const config: { vault?: string; index?: string; cleanup?: boolean } = {
    cleanup: true,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      config.vault = args[i + 1];
      i++;
    } else if (args[i] === '--index' && args[i + 1]) {
      config.index = args[i + 1];
      i++;
    } else if (args[i] === '--no-cleanup') {
      config.cleanup = false;
    }
  }

  // 기본값 설정
  if (!config.vault) {
    config.vault = path.join(os.tmpdir(), `zettel-test-vault-${Date.now()}`);
  }
  if (!config.index) {
    config.index = path.join(os.tmpdir(), `zettel-test-index-${Date.now()}.db`);
  }

  return config;
}

// 컨텍스트 생성
function createContext(vaultPath: string, indexPath: string) {
  if (!fs.existsSync(vaultPath)) {
    fs.mkdirSync(vaultPath, { recursive: true });
  }

  return {
    vaultPath,
    indexPath,
    logger: createSimpleLogger(), // 경고만 표시
    policy: { maxRetries: 1, timeoutMs: 10000 },
    mode: 'dev' as const,
  };
}

// 테스트 데이터 - 실제 프로젝트 시나리오
const testData = {
  // 1. 기술 문서
  technicalDocs: [
    {
      title: 'API Gateway 성능 최적화 가이드',
      content: `# API Gateway 성능 최적화

## 현재 문제점
- P95 응답 시간: 850ms (목표: 200ms 이하)
- 메모리 사용량: 8GB (목표: 4GB 이하)
- CPU 사용률: 평균 78% (피크 시 95%)

## 병목 지점 분석
1. **데이터베이스 쿼리 지연** - N+1 문제
   - \`/api/users/{id}/orders\` 엔드포인트에서 발생
   - 해결: Eager loading 적용

2. **인증 토큰 검증 오버헤드**
   - 매 요청마다 JWT 디코딩
   - 해결: Redis 캐시 도입

3. **로깅 동기 I/O**
   - 파일 시스템 직접 쓰기
   - 해결: 비동기 로깅 + 버퍼링

## 액션 아이템
- [ ] DataLoader 패턴 도입 (우선순위: 높음)
- [ ] Redis 세션 스토어 마이그레이션
- [ ] 비동기 로깅 라이브러리 교체 (winston -> pino)

## 참고 자료
- 내부 문서: PERF-2024-001
- Jira: BACKEND-1234`,
      category: 'Resources',
      tags: ['performance', 'api-gateway', 'optimization', 'bottleneck'],
    },
    {
      title: 'PostgreSQL 인덱스 전략',
      content: `# PostgreSQL 인덱스 전략

## 자주 사용하는 쿼리 패턴
1. \`SELECT * FROM orders WHERE user_id = ? AND status = ?\`
2. \`SELECT * FROM products WHERE category_id = ? ORDER BY created_at DESC\`
3. \`SELECT * FROM logs WHERE timestamp BETWEEN ? AND ?\`

## 인덱스 생성 권장 사항

### 복합 인덱스
\`\`\`sql
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_products_category_created ON products (category_id, created_at DESC);
\`\`\`

### 부분 인덱스
\`\`\`sql
-- 활성 주문만 인덱싱
CREATE INDEX idx_orders_active ON orders (user_id) WHERE status IN ('pending', 'processing');
\`\`\`

### 주의사항
- 인덱스가 많으면 INSERT/UPDATE 성능 저하
- VACUUM 주기적 실행 필요
- pg_stat_user_indexes로 사용률 모니터링

## 성능 측정 결과
- 인덱스 적용 전: 쿼리 평균 320ms
- 인덱스 적용 후: 쿼리 평균 15ms
- 개선율: 95.3%`,
      category: 'Resources',
      tags: ['postgresql', 'database', 'indexing', 'performance'],
    },
  ],

  // 2. 프로젝트 회의록
  meetingNotes: [
    {
      title: '2025-01-15 백엔드 팀 스프린트 리뷰',
      content: `# 스프린트 21 리뷰 회의록

**일시**: 2025-01-15 14:00-15:30
**참석자**: 김철수, 이영희, 박민수, 정수진

## 완료된 작업
- [x] 사용자 인증 리팩토링 (BACKEND-1201)
- [x] 결제 API v2 개발 (BACKEND-1198)
- [x] 로깅 시스템 개선 (BACKEND-1205)

## 진행 중
- API Gateway 성능 최적화 (BACKEND-1234) - 60% 완료
  - 문제: Redis 클러스터 설정 이슈 발생
  - 담당: 김철수
  - 예상 완료: 다음 주 화요일

- 데이터 마이그레이션 스크립트 (BACKEND-1240) - 40% 완료
  - 블로커: 스키마 변경 승인 대기
  - 담당: 이영희

## 이슈 및 논의사항
1. **Redis 메모리 문제**
   - 현재 메모리 사용률 85%
   - 결정: 메모리 증설 요청 + eviction policy 검토

2. **테스트 커버리지**
   - 현재 72%, 목표 80%
   - 액션: 각자 담당 모듈 단위 테스트 보강

3. **기술 부채**
   - deprecated 라이브러리 업데이트 필요
   - 다음 스프린트에 1일 할당

## 다음 스프린트 계획
- API Gateway 성능 최적화 완료
- 사용자 알림 서비스 개발 시작
- 코드 리뷰 프로세스 개선`,
      category: 'Areas',
      project: 'backend-sprint-21',
      tags: ['meeting', 'sprint-review', 'backend', 'team'],
    },
    {
      title: '2025-01-10 인시던트 포스트모템: 결제 서비스 장애',
      content: `# 인시던트 포스트모템

## 요약
- **인시던트 ID**: INC-2025-001
- **발생 시간**: 2025-01-10 09:15 KST
- **복구 시간**: 2025-01-10 10:45 KST
- **영향 범위**: 결제 서비스 완전 중단 (90분)
- **비즈니스 영향**: 약 1,500건 결제 실패, 예상 손실 $45,000

## 타임라인
- 09:15 - 모니터링 알람 발생 (결제 API 5xx 에러 급증)
- 09:20 - 온콜 엔지니어 확인 시작
- 09:35 - 데이터베이스 커넥션 풀 고갈 확인
- 09:50 - 원인 파악: 새 배포 코드에 커넥션 릴리즈 누락
- 10:15 - 롤백 시작
- 10:45 - 서비스 정상화 확인

## 근본 원인 (Root Cause)
새로 배포된 결제 처리 코드에서 try-finally 블록 누락으로
예외 발생 시 DB 커넥션이 반환되지 않음.

\`\`\`javascript
// 문제 코드
async function processPayment() {
  const conn = await pool.acquire();
  const result = await conn.query(...); // 여기서 예외 발생 시 conn 미반환
  pool.release(conn);
  return result;
}

// 수정 코드
async function processPayment() {
  const conn = await pool.acquire();
  try {
    const result = await conn.query(...);
    return result;
  } finally {
    pool.release(conn); // 항상 실행됨
  }
}
\`\`\`

## 재발 방지 대책
1. **단기 (1주 내)**
   - 코드 리뷰 체크리스트에 리소스 정리 항목 추가
   - DB 커넥션 모니터링 알람 임계값 하향 조정

2. **중기 (1개월 내)**
   - 통합 테스트에 커넥션 풀 상태 검증 추가
   - 카나리 배포 도입으로 영향 범위 최소화

3. **장기 (분기 내)**
   - ORM 또는 커넥션 관리 라이브러리 도입 검토
   - 자동화된 리소스 누수 탐지 도구 적용`,
      category: 'Archives',
      tags: ['incident', 'postmortem', 'payment', 'database', 'outage'],
    },
  ],

  // 3. 코드 리뷰
  codeReviews: [
    {
      title: 'PR #456 코드 리뷰: 캐시 레이어 구현',
      content: `# Pull Request 리뷰 노트

**PR**: #456 - Add Redis cache layer for user service
**작성자**: 박민수
**리뷰어**: 김철수

## 전반적인 평가
캐시 레이어 구현은 잘 되어 있으나, 몇 가지 개선 사항이 있습니다.

## 주요 피드백

### 1. 캐시 무효화 전략 (Critical)
현재 TTL 기반만 사용 중입니다. 데이터 변경 시 즉시 무효화 필요합니다.

\`\`\`typescript
// 현재 코드
async updateUser(id: string, data: UserData) {
  await this.db.update(id, data);
  // 캐시 무효화 없음!
}

// 제안
async updateUser(id: string, data: UserData) {
  await this.db.update(id, data);
  await this.cache.del(\`user:\${id}\`); // 즉시 무효화
}
\`\`\`

### 2. 에러 핸들링 (Major)
캐시 실패 시 서비스가 중단되면 안 됩니다.

\`\`\`typescript
// 현재 - 캐시 에러가 전파됨
const user = await cache.get(key);

// 제안 - 그레이스풀 디그레이드
try {
  const cached = await cache.get(key);
  if (cached) return cached;
} catch (err) {
  logger.warn('Cache read failed', { err });
  // fallback to database
}
\`\`\`

### 3. 타입 안전성 (Minor)
제네릭 타입 사용을 권장합니다.

### 4. 테스트 커버리지
- 캐시 히트/미스 시나리오 ✅
- 캐시 에러 시나리오 ❌ (추가 필요)
- 동시성 시나리오 ❌ (추가 필요)

## 승인 조건
1. 캐시 무효화 로직 추가
2. 에러 핸들링 개선
3. 누락된 테스트 케이스 추가

## 관련 문서
- 캐싱 전략 가이드: [ARCH-DOC-005]
- Redis 운영 가이드: [OPS-DOC-012]`,
      category: 'Projects',
      project: 'code-review',
      tags: ['code-review', 'redis', 'caching', 'pull-request', 'improvement'],
    },
  ],

  // 4. 버그 리포트
  bugReports: [
    {
      title: 'BUG-2025-042: 동시 로그인 시 세션 충돌',
      content: `# 버그 리포트

## 기본 정보
- **ID**: BUG-2025-042
- **심각도**: High
- **우선순위**: P1
- **상태**: In Progress
- **담당자**: 정수진

## 문제 설명
동일 사용자가 여러 디바이스에서 동시 로그인 시 세션이 충돌하여
무작위로 로그아웃되는 현상 발생

## 재현 단계
1. 사용자 A가 모바일에서 로그인
2. 같은 사용자 A가 웹에서 로그인
3. 모바일에서 API 요청 실행
4. 50% 확률로 401 Unauthorized 발생

## 예상 동작
모든 디바이스에서 세션이 유지되어야 함

## 실제 동작
세션 토큰이 덮어써져서 이전 세션이 무효화됨

## 환경
- OS: iOS 17, Android 14, Chrome 120
- API 버전: v2.3.1
- 서버: production-api-01

## 로그 분석
\`\`\`
[ERROR] 2025-01-14 11:23:45 SessionManager: Token mismatch
  user_id: usr_12345
  expected_token: tk_abc...
  received_token: tk_def...
  device_id: device_mobile_001
\`\`\`

## 근본 원인 분석
Redis에 세션 저장 시 키가 \`session:{user_id}\`로 되어 있어
디바이스별 구분 없이 덮어쓰기됨.

## 해결 방안
세션 키를 \`session:{user_id}:{device_id}\`로 변경하여
디바이스별 세션 분리

## 영향 범위
- 영향받는 사용자: 전체 사용자의 약 15%
- 관련 기능: 인증, 세션 관리, 보안

## 워크어라운드
현재 없음. 단일 디바이스 사용 권장

## 테스트 케이스
- [ ] 다중 디바이스 동시 로그인
- [ ] 세션 만료 시 특정 디바이스만 로그아웃
- [ ] 디바이스별 세션 revoke`,
      category: 'Projects',
      project: 'bug-tracking',
      tags: ['bug', 'session', 'authentication', 'high-priority', 'concurrent'],
    },
  ],

  // 5. 아키텍처 설계
  architectureNotes: [
    {
      title: '마이크로서비스 분리 계획: 주문 도메인',
      content: `# 주문 도메인 마이크로서비스 분리

## 현재 상태
모놀리식 아키텍처에서 주문 처리 로직이 다음과 혼재:
- 사용자 관리
- 재고 관리
- 결제 처리
- 배송 추적

## 분리 목표
주문 도메인을 독립적인 마이크로서비스로 분리

## 경계 컨텍스트 (Bounded Context)

### Order Service 책임
- 주문 생성/수정/취소
- 주문 상태 관리
- 주문 이력 조회

### 통신 방식
- 동기: REST API (주문 조회)
- 비동기: 이벤트 (주문 생성, 상태 변경)

\`\`\`
[User Service] --REST--> [Order Service] --Event--> [Inventory Service]
                                         --Event--> [Payment Service]
                                         --Event--> [Notification Service]
\`\`\`

## 데이터 모델

### 주문 Aggregate
\`\`\`typescript
interface Order {
  id: string;
  userId: string;           // Reference only
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: Money;
  shippingAddress: Address;
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface OrderItem {
  productId: string;        // Reference only
  productName: string;      // Snapshot at order time
  quantity: number;
  unitPrice: Money;
}
\`\`\`

## 마이그레이션 전략

### Phase 1: 스트랭글러 패턴
1. 새 Order Service 구축
2. API Gateway에서 트래픽 라우팅
3. 읽기 작업부터 점진적 전환

### Phase 2: 데이터 동기화
1. CDC (Change Data Capture) 설정
2. 이벤트 소싱으로 데이터 동기화
3. 모놀리스와 병렬 운영

### Phase 3: 완전 분리
1. 쓰기 작업 전환
2. 모놀리스 코드 제거
3. 독립 배포 파이프라인 구축

## 리스크
- 분산 트랜잭션 관리 복잡성
- 네트워크 지연 증가
- 운영 복잡도 증가

## 성공 지표
- 배포 주기: 월 1회 → 주 2회
- 장애 격리: 전체 영향 → 서비스별 격리
- 확장성: 수평 확장 가능`,
      category: 'Resources',
      tags: ['microservices', 'architecture', 'domain-driven-design', 'migration', 'order-service'],
    },
  ],
};

// 메인 테스트 함수
async function runComplexScenarioTest() {
  const config = parseArgs();

  console.log('🚀 복잡한 시나리오 테스트 시작\n');
  console.log(`Vault 경로: ${config.vault}`);
  console.log(`Index 경로: ${config.index}`);
  console.log(`자동 정리: ${config.cleanup ? 'Yes' : 'No'}\n`);

  const context = createContext(config.vault, config.index);
  const createdNotes: Array<{ uid: string; title: string; tags: string[] }> = [];

  try {
    // 1. 모든 테스트 데이터 입력
    console.log('📝 테스트 데이터 입력 중...\n');

    // 기술 문서
    console.log('  [1/5] 기술 문서 입력...');
    for (const doc of testData.technicalDocs) {
      const result = await executeTool('create_note', doc, context);
      const uid = (result._meta?.metadata as any)?.id;
      createdNotes.push({ uid, title: doc.title, tags: doc.tags });
      console.log(`    ✅ ${doc.title}`);
    }

    // 회의록
    console.log('  [2/5] 회의록 입력...');
    for (const note of testData.meetingNotes) {
      const result = await executeTool('create_note', note, context);
      const uid = (result._meta?.metadata as any)?.id;
      createdNotes.push({ uid, title: note.title, tags: note.tags });
      console.log(`    ✅ ${note.title}`);
    }

    // 코드 리뷰
    console.log('  [3/5] 코드 리뷰 입력...');
    for (const review of testData.codeReviews) {
      const result = await executeTool('create_note', review, context);
      const uid = (result._meta?.metadata as any)?.id;
      createdNotes.push({ uid, title: review.title, tags: review.tags });
      console.log(`    ✅ ${review.title}`);
    }

    // 버그 리포트
    console.log('  [4/5] 버그 리포트 입력...');
    for (const bug of testData.bugReports) {
      const result = await executeTool('create_note', bug, context);
      const uid = (result._meta?.metadata as any)?.id;
      createdNotes.push({ uid, title: bug.title, tags: bug.tags });
      console.log(`    ✅ ${bug.title}`);
    }

    // 아키텍처 노트
    console.log('  [5/5] 아키텍처 노트 입력...');
    for (const arch of testData.architectureNotes) {
      const result = await executeTool('create_note', arch, context);
      const uid = (result._meta?.metadata as any)?.id;
      createdNotes.push({ uid, title: arch.title, tags: arch.tags });
      console.log(`    ✅ ${arch.title}`);
    }

    console.log(`\n총 ${createdNotes.length}개 노트 생성 완료\n`);

    // 2. 검색 시나리오 실행
    console.log('🔍 검색 시나리오 테스트\n');

    // 시나리오 1: 성능 관련 이슈 찾기
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 1: "성능 최적화 관련 모든 자료 찾기"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const perfNotes = await executeTool(
      'list_notes',
      { tags: ['performance'] },
      context
    );
    console.log('결과:');
    console.log(perfNotes.content[0]?.text || '결과 없음');
    console.log(`\n메타데이터: 총 ${(perfNotes._meta?.metadata as any)?.total}개 노트 발견\n`);

    // 시나리오 2: 특정 프로젝트 관련 노트 조회
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 2: "진행 중인 버그 트래킹 프로젝트 노트"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const bugProject = await executeTool(
      'list_notes',
      { project: 'bug-tracking' },
      context
    );
    console.log('결과:');
    console.log(bugProject.content[0]?.text || '결과 없음');
    console.log();

    // 시나리오 3: 높은 우선순위 버그 찾기
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 3: "높은 우선순위 버그 검색"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const highPriorityBugs = await executeTool(
      'list_notes',
      { tags: ['high-priority'] },
      context
    );
    console.log('결과:');
    console.log(highPriorityBugs.content[0]?.text || '결과 없음');
    console.log();

    // 시나리오 4: 데이터베이스 관련 모든 문서
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 4: "데이터베이스 관련 모든 지식 (카테고리: Resources)"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dbResources = await executeTool(
      'list_notes',
      { category: 'Resources', tags: ['database'] },
      context
    );
    console.log('결과:');
    console.log(dbResources.content[0]?.text || '결과 없음');
    console.log();

    // 시나리오 5: 인시던트 및 포스트모템
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 5: "과거 인시던트 회고 문서"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const incidents = await executeTool(
      'list_notes',
      { category: 'Archives', tags: ['incident'] },
      context
    );
    console.log('결과:');
    console.log(incidents.content[0]?.text || '결과 없음');
    console.log();

    // 시나리오 6: 코드 리뷰 개선 사항
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 6: "코드 리뷰에서 지적된 개선 사항"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const codeReviewIssues = await executeTool(
      'list_notes',
      { tags: ['improvement', 'code-review'] },
      context
    );
    console.log('결과:');
    console.log(codeReviewIssues.content[0]?.text || '결과 없음');
    console.log();

    // 시나리오 7: 아키텍처 관련 마이그레이션 계획
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('시나리오 7: "마이그레이션 관련 아키텍처 문서"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const migrationDocs = await executeTool(
      'list_notes',
      { tags: ['migration'] },
      context
    );
    console.log('결과:');
    console.log(migrationDocs.content[0]?.text || '결과 없음');
    console.log();

    // 3. 특정 노트 상세 조회
    console.log('📋 특정 이슈 상세 조회\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('버그 리포트 상세 내용 조회');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const bugNote = createdNotes.find((n) => n.tags.includes('bug'));
    if (bugNote) {
      const bugDetail = await executeTool(
        'read_note',
        { uid: bugNote.uid, includeMetadata: true },
        context
      );
      console.log(bugDetail.content[0]?.text || '결과 없음');
      console.log('\n메타데이터:');
      const bugMeta = bugDetail._meta?.metadata as any;
      console.log(`  - 단어 수: ${bugMeta?.wordCount || 'N/A'}`);
      console.log(`  - 문자 수: ${bugMeta?.characterCount || 'N/A'}`);
      console.log(`  - 파일 크기: ${((bugMeta?.fileSize || 0) / 1024).toFixed(2)} KB`);
    }

    // 4. 요약
    console.log('\n\n✅ 테스트 완료 요약\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`총 생성된 노트: ${createdNotes.length}개`);
    console.log('카테고리 분포:');

    const allNotes = await executeTool('list_notes', {}, context);
    const meta = allNotes._meta?.metadata as any;
    console.log(`  - 전체: ${meta?.total}개`);

    for (const cat of ['Projects', 'Areas', 'Resources', 'Archives']) {
      const catNotes = await executeTool('list_notes', { category: cat }, context);
      console.log(`  - ${cat}: ${(catNotes._meta?.metadata as any)?.total || 0}개`);
    }

    console.log('\n주요 태그 분포:');
    const importantTags = ['performance', 'database', 'bug', 'incident', 'architecture'];
    for (const tag of importantTags) {
      const tagNotes = await executeTool('list_notes', { tags: [tag] }, context);
      console.log(`  - ${tag}: ${(tagNotes._meta?.metadata as any)?.total || 0}개`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 정리
    if (config.cleanup) {
      console.log('\n🧹 테스트 데이터 정리 중...');
      fs.rmSync(config.vault, { recursive: true, force: true });
      if (fs.existsSync(config.index)) {
        fs.unlinkSync(config.index);
      }
      console.log('✅ 정리 완료');
    } else {
      console.log('\n💾 테스트 데이터 보존됨:');
      console.log(`  Vault: ${config.vault}`);
      console.log(`  Index: ${config.index}`);
    }

    console.log('\n🎉 모든 시나리오 테스트 성공!\n');
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 실행
runComplexScenarioTest();
