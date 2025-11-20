/**
 * MCP 클라이언트 시뮬레이션
 * MCP 서버와 stdin/stdout으로 통신하여 organize_notes 도구를 테스트합니다.
 */

import { spawn } from 'child_process';
import path from 'path';

interface MCPRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: '2.0';
    id: number;
    result?: any;
    error?: any;
}

class MCPClient {
    private serverProcess: any;
    private requestId = 1;
    private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

    constructor(private serverPath: string, private vaultPath: string) { }

    async start() {
        console.log('🚀 MCP 서버 시작 중...\n');

        this.serverProcess = spawn('node', [this.serverPath], {
            env: {
                ...process.env,
                VAULT_PATH: this.vaultPath,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.serverProcess.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const response: MCPResponse = JSON.parse(line);
                    const pending = this.pendingRequests.get(response.id);

                    if (pending) {
                        this.pendingRequests.delete(response.id);
                        if (response.error) {
                            pending.reject(response.error);
                        } else {
                            pending.resolve(response.result);
                        }
                    }
                } catch (e) {
                    // 로그 메시지는 무시
                }
            }
        });

        this.serverProcess.stderr.on('data', (data: Buffer) => {
            const msg = data.toString();
            if (!msg.includes('[INFO]') && !msg.includes('[DEBUG]')) {
                console.error('서버 오류:', msg);
            }
        });

        // 서버 초기화 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ MCP 서버 시작 완료\n');
    }

    async sendRequest(method: string, params?: any): Promise<any> {
        const id = this.requestId++;
        const request: MCPRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

            // 타임아웃 설정 (30초)
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    async initialize() {
        console.log('📋 서버 초기화 중...\n');
        const result = await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'test-client',
                version: '1.0.0',
            },
        });
        console.log('✅ 초기화 완료:', result.serverInfo.name, result.serverInfo.version, '\n');
        return result;
    }

    async listTools() {
        console.log('🔧 사용 가능한 도구 목록 조회 중...\n');
        const result = await this.sendRequest('tools/list');
        console.log(`✅ 총 ${result.tools.length}개의 도구 발견:\n`);

        result.tools.forEach((tool: any, index: number) => {
            console.log(`${index + 1}. ${tool.name}`);
            console.log(`   ${tool.description}\n`);
        });

        return result;
    }

    async callTool(name: string, args: any) {
        console.log(`⚙️  도구 호출: ${name}`);
        console.log(`📥 입력:`, JSON.stringify(args, null, 2), '\n');

        const result = await this.sendRequest('tools/call', {
            name,
            arguments: args,
        });

        console.log('📤 결과:\n');
        if (result.content && result.content[0]) {
            console.log(result.content[0].text);
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
        console.log('\n');

        return result;
    }

    async stop() {
        console.log('🛑 MCP 서버 종료 중...\n');
        this.serverProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ 종료 완료\n');
    }
}

async function runSimulation() {
    const serverPath = path.join(__dirname, '../packages/mcp-server/dist/cli.js');
    const vaultPath = path.join(__dirname, '../test-vault');

    const client = new MCPClient(serverPath, vaultPath);

    try {
        // 1. 서버 시작
        await client.start();

        // 2. 초기화
        await client.initialize();

        // 3. 도구 목록 조회
        await client.listTools();

        // 4. organize_notes 호출 (dryRun)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🧪 테스트 1: organize_notes (dryRun: true)\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await client.callTool('organize_notes', {
            dryRun: true,
            limit: 5,
        });

        // 5. 다른 도구들도 테스트
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🧪 테스트 2: list_notes\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await client.callTool('list_notes', {
            limit: 10,
        });

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await client.stop();
    }
}

// 실행
console.log('\n');
console.log('╔════════════════════════════════════════╗');
console.log('║   MCP 클라이언트 시뮬레이션 시작      ║');
console.log('╚════════════════════════════════════════╝');
console.log('\n');

runSimulation().catch(console.error);
