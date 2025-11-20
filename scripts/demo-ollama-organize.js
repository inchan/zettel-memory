#!/usr/bin/env node
/**
 * Ollama 기반 노트 정리 데모
 * 실제 데이터를 생성하고 organize_notes 도구를 테스트합니다.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

// MCP 클라이언트
class MCPClient {
    constructor() {
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.buffer = '';
    }

    async start(vaultPath, indexPath) {
        const cliPath = path.join(__dirname, '../packages/mcp-server/dist/cli.js');

        // 테스트 디렉토리 준비
        if (fs.existsSync(vaultPath)) {
            fs.rmSync(vaultPath, { recursive: true });
        }
        fs.mkdirSync(vaultPath, { recursive: true });

        if (fs.existsSync(indexPath)) {
            fs.unlinkSync(indexPath);
        }

        this.process = spawn('node', [cliPath, '--vault', vaultPath, '--index', indexPath, '--timeout', '30000'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.vaultPath = vaultPath;

        this.process.stdout.on('data', (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });

        this.process.stderr.on('data', (data) => {
            // 로그는 stderr로 출력됨
        });

        // 초기화
        await this.sendRequest('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'demo-client', version: '1.0.0' },
        });

        await this.sendNotification('notifications/initialized', {});
    }

    processBuffer() {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                        const { resolve, reject } = this.pendingRequests.get(message.id);
                        this.pendingRequests.delete(message.id);
                        if (message.error) {
                            reject(new Error(message.error.message));
                        } else {
                            resolve(message.result);
                        }
                    }
                } catch (e) {
                    // JSON 파싱 에러 무시
                }
            }
        }
    }

    sendNotification(method, params) {
        const message = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this.process.stdin.write(JSON.stringify(message) + '\n');
    }

    sendRequest(method, params) {
        return new Promise((resolve, reject) => {
            const id = this.requestId++;
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };

            this.pendingRequests.set(id, { resolve, reject });
            this.process.stdin.write(JSON.stringify(message) + '\n');

            // 타임아웃
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    async callTool(name, args) {
        return this.sendRequest('tools/call', { name, arguments: args });
    }

    async close() {
        this.process.kill();
    }
}

// 샘플 노트 데이터
const sampleNotes = [
    {
        title: '프로젝트 Alpha 킥오프 미팅',
        content: '새로운 프로젝트 Alpha의 킥오프 미팅을 진행했습니다.\n\n주요 논의 사항:\n- UI/UX 디자인 방향성\n- 백엔드 아키텍처 설계\n- 일정 및 마일스톤\n\n다음 미팅: 2주 후',
        category: 'Projects',
        tags: ['meeting', 'project-alpha', 'planning'],
    },
    {
        title: 'UI 컴포넌트 디자인 가이드',
        content: '프로젝트에서 사용할 UI 컴포넌트 디자인 가이드라인입니다.\n\n- 버튼 스타일: Material Design 기반\n- 색상 팔레트: Blue (#2196F3), Green (#4CAF50)\n- 타이포그래피: Roboto 폰트 사용\n\n참고: [[design-system]]',
        category: 'Resources',
        tags: ['design', 'ui', 'components'],
    },
    {
        title: 'TypeScript 베스트 프랙티스',
        content: 'TypeScript 개발 시 따라야 할 베스트 프랙티스 모음입니다.\n\n1. 명시적 타입 정의 사용\n2. any 타입 지양\n3. strict 모드 활성화\n4. 인터페이스보다 타입 별칭 선호\n\n관련: [[javascript-patterns]]',
        category: 'Resources',
        tags: ['typescript', 'programming', 'best-practices'],
    },
    {
        title: '주간 회고',
        content: '이번 주 작업 회고입니다.\n\n잘한 점:\n- 프로젝트 Alpha 킥오프 성공\n- UI 컴포넌트 가이드 작성 완료\n\n개선할 점:\n- 코드 리뷰 시간 부족\n- 문서화 미흡\n\n다음 주 목표:\n- 백엔드 API 설계 완료\n- 프론트엔드 프로토타입 개발',
        category: 'Areas',
        tags: ['retrospective', 'weekly', 'reflection'],
    },
    {
        title: 'API 설계 문서',
        content: '백엔드 API 설계 문서입니다.\n\n엔드포인트:\n- GET /api/users - 사용자 목록 조회\n- POST /api/users - 사용자 생성\n- PUT /api/users/:id - 사용자 수정\n- DELETE /api/users/:id - 사용자 삭제\n\n인증: JWT 토큰 사용\n\n관련: [[project-alpha]]',
        category: 'Projects',
        tags: ['api', 'backend', 'project-alpha'],
    },
    {
        title: 'React Hooks 정리',
        content: 'React Hooks 사용법 정리입니다.\n\n주요 Hooks:\n- useState: 상태 관리\n- useEffect: 사이드 이펙트 처리\n- useContext: 컨텍스트 사용\n- useMemo: 메모이제이션\n- useCallback: 콜백 메모이제이션\n\n참고: [[react-patterns]]',
        category: 'Resources',
        tags: ['react', 'hooks', 'frontend'],
    },
    {
        title: '장보기 목록',
        content: '주말에 장볼 것들:\n\n- 우유\n- 계란\n- 빵\n- 과일 (사과, 바나나)\n- 채소 (양파, 당근)\n\n예산: 5만원',
        category: 'Archives',
        tags: ['personal', 'shopping'],
    },
    {
        title: 'Git 워크플로우',
        content: '팀에서 사용하는 Git 워크플로우입니다.\n\n브랜치 전략:\n- main: 프로덕션 코드\n- develop: 개발 중인 코드\n- feature/*: 기능 개발\n- hotfix/*: 긴급 수정\n\n커밋 메시지 규칙:\n- feat: 새 기능\n- fix: 버그 수정\n- docs: 문서 수정\n- refactor: 리팩토링',
        category: 'Resources',
        tags: ['git', 'workflow', 'development'],
    },
    {
        title: '데이터베이스 스키마',
        content: '프로젝트 Alpha의 데이터베이스 스키마입니다.\n\nUsers 테이블:\n- id (PK)\n- email (UNIQUE)\n- name\n- created_at\n- updated_at\n\nPosts 테이블:\n- id (PK)\n- user_id (FK)\n- title\n- content\n- created_at\n\n관련: [[api-design]] [[project-alpha]]',
        category: 'Projects',
        tags: ['database', 'schema', 'project-alpha'],
    },
    {
        title: '독서 노트: Clean Code',
        content: 'Clean Code 책을 읽고 정리한 내용입니다.\n\n핵심 원칙:\n- 의미 있는 이름 사용\n- 함수는 한 가지 일만\n- 주석보다 코드로 설명\n- 에러 처리 잘하기\n\n인상 깊은 구절:\n"나쁜 코드는 나쁜 코드를 부른다"\n\n적용할 점:\n- 함수 길이 줄이기\n- 변수명 개선',
        category: 'Resources',
        tags: ['book', 'clean-code', 'programming'],
    },
];

async function runDemo() {
    log(colors.blue, '\n╔════════════════════════════════════════════════╗');
    log(colors.blue, '║  Ollama 기반 노트 정리 데모                   ║');
    log(colors.blue, '╚════════════════════════════════════════════════╝\n');

    const vaultPath = '/tmp/ollama-demo-vault';
    const indexPath = '/tmp/ollama-demo-index.db';

    const client = new MCPClient();

    try {
        // 1. MCP 서버 시작
        log(colors.yellow, '📡 MCP 서버 시작 중...');
        await client.start(vaultPath, indexPath);
        log(colors.green, '✅ MCP 서버 시작 완료\n');

        // 2. 샘플 노트 생성
        log(colors.yellow, `📝 ${sampleNotes.length}개의 샘플 노트 생성 중...\n`);

        for (let i = 0; i < sampleNotes.length; i++) {
            const note = sampleNotes[i];
            const result = await client.callTool('create_note', note);
            const uid = result._meta?.metadata?.id;
            log(colors.cyan, `  ${i + 1}. ${note.title} (${uid})`);
        }

        log(colors.green, '\n✅ 모든 노트 생성 완료\n');

        // 3. 노트 목록 확인
        log(colors.yellow, '📋 생성된 노트 목록:\n');
        const listResult = await client.callTool('list_notes', { limit: 20 });
        const notes = listResult._meta?.metadata?.notes || [];

        notes.forEach((note, i) => {
            log(colors.cyan, `  ${i + 1}. [${note.category}] ${note.title}`);
            log(colors.reset, `     태그: ${note.tags.join(', ')}`);
        });

        log(colors.green, `\n총 ${notes.length}개 노트\n`);

        // 4. organize_notes 실행 (dryRun)
        log(colors.blue, '\n' + '='.repeat(50));
        log(colors.magenta, '\n🤖 Ollama를 통한 노트 정리 시작 (dryRun 모드)\n');
        log(colors.blue, '='.repeat(50) + '\n');

        const organizeResult = await client.callTool('organize_notes', {
            dryRun: true,
            limit: 10,
        });

        if (organizeResult.content && organizeResult.content[0]) {
            log(colors.yellow, organizeResult.content[0].text);
        }

        log(colors.blue, '\n' + '='.repeat(50) + '\n');

        // 5. 실제 적용 여부 확인
        log(colors.yellow, '\n💡 실제로 변경사항을 적용하려면 dryRun: false로 설정하세요.\n');
        log(colors.cyan, '예시:');
        log(colors.reset, '  await client.callTool(\'organize_notes\', {');
        log(colors.reset, '    dryRun: false,');
        log(colors.reset, '    limit: 10');
        log(colors.reset, '  });\n');

    } catch (error) {
        log(colors.red, '\n❌ 오류 발생:', error.message);

        if (error.message.includes('Ollama')) {
            log(colors.yellow, '\n💡 Ollama가 실행 중이 아닙니다. 다음 명령어로 시작하세요:');
            log(colors.cyan, '   ollama serve');
            log(colors.yellow, '\n또는 Ollama를 설치하세요:');
            log(colors.cyan, '   https://ollama.ai\n');
        }
    } finally {
        await client.close();
        log(colors.green, '✅ 데모 완료\n');
    }
}

runDemo().catch(console.error);
