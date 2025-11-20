#!/usr/bin/env node
/**
 * Ollama 미설치/미실행 시나리오 시뮬레이션
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

class MCPClient {
    constructor() {
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.buffer = '';
    }

    async start(vaultPath, indexPath) {
        const cliPath = path.join(__dirname, '../packages/mcp-server/dist/cli.js');

        if (fs.existsSync(vaultPath)) {
            fs.rmSync(vaultPath, { recursive: true });
        }
        fs.mkdirSync(vaultPath, { recursive: true });

        if (fs.existsSync(indexPath)) {
            fs.unlinkSync(indexPath);
        }

        this.process = spawn('node', [cliPath, '--vault', vaultPath, '--index', indexPath, '--timeout', '10000'], {
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

        await this.sendRequest('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
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

            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 15000);
        });
    }

    async callTool(name, args) {
        return this.sendRequest('tools/call', { name, arguments: args });
    }

    async close() {
        this.process.kill();
    }
}

async function runSimulation() {
    log(colors.blue, '\n╔════════════════════════════════════════════════╗');
    log(colors.blue, '║  Ollama 미설치/미실행 시나리오 시뮬레이션    ║');
    log(colors.blue, '╚════════════════════════════════════════════════╝\n');

    // Ollama 강제 중지
    log(colors.yellow, '🛑 Ollama 서버 중지 중...');
    const { execSync } = require('child_process');
    try {
        execSync('killall -9 ollama 2>/dev/null || true');
        await new Promise(resolve => setTimeout(resolve, 1000));
        log(colors.green, '✅ Ollama 서버 중지 완료\n');
    } catch (e) {
        log(colors.yellow, '⚠️  Ollama가 실행 중이지 않았습니다\n');
    }

    const vaultPath = '/tmp/ollama-error-test-vault';
    const indexPath = '/tmp/ollama-error-test-index.db';

    const client = new MCPClient();

    try {
        log(colors.yellow, '📡 MCP 서버 시작 중...');
        await client.start(vaultPath, indexPath);
        log(colors.green, '✅ MCP 서버 시작 완료\n');

        // 테스트 노트 생성
        log(colors.yellow, '📝 테스트 노트 생성 중...\n');

        await client.callTool('create_note', {
            title: '테스트 노트 1',
            content: '이것은 테스트 노트입니다.',
            category: 'Resources',
            tags: ['test'],
        });

        await client.callTool('create_note', {
            title: '테스트 노트 2',
            content: '또 다른 테스트 노트입니다.',
            category: 'Projects',
            tags: ['test', 'demo'],
        });

        log(colors.green, '✅ 테스트 노트 생성 완료\n');

        // Ollama 상태 확인
        log(colors.blue, '\n' + '='.repeat(50));
        log(colors.yellow, '\n🔍 Ollama 서버 상태 확인 중...\n');

        let ollamaRunning = false;
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            ollamaRunning = response.ok;
        } catch (error) {
            ollamaRunning = false;
        }

        if (ollamaRunning) {
            log(colors.red, '❌ Ollama 서버가 여전히 실행 중입니다.');
            log(colors.yellow, '   (자동 재시작되었을 수 있음)\n');
        } else {
            log(colors.green, '✅ Ollama 서버가 중지되었습니다.');
            log(colors.yellow, '   (시뮬레이션 진행)\n');
        }

        log(colors.blue, '='.repeat(50) + '\n');

        // organize_notes 호출 시도
        log(colors.magenta, '\n🤖 organize_notes 도구 호출 시도...\n');
        log(colors.cyan, '   입력: { dryRun: true, limit: 5 }\n');

        try {
            const result = await client.callTool('organize_notes', {
                dryRun: true,
                limit: 5,
            });

            log(colors.yellow, '\n📤 응답:\n');
            if (result.content && result.content[0]) {
                log(colors.reset, result.content[0].text);
            }

        } catch (error) {
            log(colors.red, '\n❌ 오류 발생:\n');
            log(colors.red, `   ${error.message}\n`);

            log(colors.blue, '\n' + '='.repeat(50));
            log(colors.yellow, '\n💡 이것이 Ollama 미설치/미실행 시 발생하는 상황입니다!\n');
            log(colors.blue, '='.repeat(50) + '\n');
        }

        // 다른 도구들은 정상 작동하는지 확인
        log(colors.yellow, '\n📋 다른 MCP 도구들은 정상 작동하는지 확인...\n');

        try {
            const listResult = await client.callTool('list_notes', { limit: 10 });
            const noteCount = listResult._meta?.metadata?.total || 0;
            log(colors.green, `✅ list_notes 도구: 정상 작동 (${noteCount}개 노트 조회)\n`);
        } catch (error) {
            log(colors.red, `❌ list_notes 도구 오류: ${error.message}\n`);
        }

        // 요약
        log(colors.blue, '\n' + '='.repeat(50));
        log(colors.cyan, '\n📊 시뮬레이션 요약\n');
        log(colors.blue, '='.repeat(50) + '\n');

        log(colors.yellow, '🔸 Ollama 미설치/미실행 시:\n');
        log(colors.reset, '   1. MCP 서버는 정상적으로 시작됩니다');
        log(colors.reset, '   2. 다른 모든 도구들은 정상 작동합니다');
        log(colors.reset, '   3. organize_notes만 오류를 반환합니다');
        log(colors.reset, '   4. 사용자에게 친절한 오류 메시지를 제공합니다\n');

        log(colors.yellow, '🔸 해결 방법:\n');
        log(colors.cyan, '   1. Ollama 설치: https://ollama.ai');
        log(colors.cyan, '   2. Ollama 서버 시작: ollama serve');
        log(colors.cyan, '   3. 모델 다운로드: ollama pull llama3.2:3b\n');

    } catch (error) {
        log(colors.red, '\n❌ 시뮬레이션 오류:', error.message);
    } finally {
        await client.close();
        log(colors.green, '\n✅ 시뮬레이션 완료\n');
    }
}

runSimulation().catch(console.error);
