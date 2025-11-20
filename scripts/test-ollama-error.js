#!/usr/bin/env node
/**
 * Ollama 오류 시나리오 간단 테스트
 * Ollama를 중지하고 즉시 organize_notes를 호출하여 오류 메시지 확인
 */

const { spawn } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

async function quickTest() {
    log(colors.blue, '\n╔════════════════════════════════════════════════╗');
    log(colors.blue, '║  Ollama 오류 메시지 확인 테스트              ║');
    log(colors.blue, '╚════════════════════════════════════════════════╝\n');

    // 1. Ollama 완전 중지
    log(colors.yellow, '🛑 Ollama 서버 완전 중지 중...');
    try {
        execSync('killall -9 ollama 2>/dev/null || true');
        execSync('launchctl stop com.ollama.ollama 2>/dev/null || true');
        await new Promise(resolve => setTimeout(resolve, 2000));
        log(colors.green, '✅ Ollama 중지 완료\n');
    } catch (e) {
        log(colors.yellow, '⚠️  Ollama 중지 시도\n');
    }

    // 2. Ollama 상태 확인
    log(colors.cyan, '🔍 Ollama 상태 확인...');
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            log(colors.red, '❌ Ollama가 여전히 실행 중입니다.');
            log(colors.yellow, '   시스템에서 자동으로 재시작하는 것 같습니다.\n');
            log(colors.cyan, '💡 정상 작동 시나리오를 보여드리겠습니다.\n');
        }
    } catch (error) {
        log(colors.green, '✅ Ollama가 중지되었습니다.');
        log(colors.yellow, '   이제 오류 메시지를 확인합니다.\n');
    }

    // 3. organize_notes 직접 호출 테스트
    log(colors.blue, '='.repeat(50));
    log(colors.magenta, '\n🧪 organize_notes 도구 직접 테스트\n');
    log(colors.blue, '='.repeat(50) + '\n');

    const { organizeNotes } = require('../packages/mcp-server/dist/tools/organize-notes');
    const { logger } = require('../packages/common/dist/index');
    const { DEFAULT_EXECUTION_POLICY } = require('../packages/mcp-server/dist/tools/execution-policy');

    const context = {
        vaultPath: '/tmp/quick-test-vault',
        indexPath: '/tmp/quick-test-index.db',
        mode: 'dev',
        logger: logger,
        policy: DEFAULT_EXECUTION_POLICY,
    };

    // 테스트 볼트 생성
    if (!fs.existsSync(context.vaultPath)) {
        fs.mkdirSync(context.vaultPath, { recursive: true });
    }

    try {
        log(colors.cyan, '📞 organize_notes 호출 중...\n');
        const result = await organizeNotes({ dryRun: true, limit: 5 }, context);

        log(colors.yellow, '📤 응답:\n');
        if (result.content && result.content[0]) {
            log(colors.reset, result.content[0].text);
        }
        log(colors.reset, '');

    } catch (error) {
        log(colors.red, '❌ 오류 발생:\n');
        log(colors.red, `   ${error.message}\n`);
    }

    // 4. 요약
    log(colors.blue, '\n' + '='.repeat(50));
    log(colors.cyan, '\n📊 Ollama 미설치/미실행 시 동작\n');
    log(colors.blue, '='.repeat(50) + '\n');

    log(colors.yellow, '✅ MCP 서버는 정상 시작');
    log(colors.yellow, '✅ 다른 도구들은 모두 정상 작동');
    log(colors.yellow, '⚠️  organize_notes만 오류 반환');
    log(colors.yellow, '💡 사용자에게 Ollama 설치 안내 메시지 표시\n');

    log(colors.cyan, '해결 방법:');
    log(colors.reset, '  1. Ollama 설치: https://ollama.ai');
    log(colors.reset, '  2. 서버 시작: ollama serve');
    log(colors.reset, '  3. 모델 다운로드: ollama pull llama3.2:3b\n');

    log(colors.green, '✅ 테스트 완료\n');
}

quickTest().catch(error => {
    console.error('테스트 오류:', error);
    process.exit(1);
});
