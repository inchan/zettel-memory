#!/bin/bash

# MCP 서버 검증 스크립트
# MCP Inspector를 사용하여 프로토콜 준수 여부 검증

set -e

echo "🔍 Memory MCP 서버 검증 시작..."
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 빌드 확인
echo "1️⃣ 서버 빌드 확인..."
if [ ! -f "packages/mcp-server/dist/cli.js" ]; then
    echo -e "${YELLOW}⚠️  빌드된 파일이 없습니다. 빌드를 먼저 실행합니다...${NC}"
    npm run build
fi
echo -e "${GREEN}✅ 빌드 확인 완료${NC}"
echo ""

# 2. 테스트 vault 준비
echo "2️⃣ 테스트 환경 준비..."
TEST_VAULT="./test-vault"
TEST_INDEX="./test-index.db"

# 기존 테스트 데이터 정리
rm -rf "$TEST_VAULT" "$TEST_INDEX"
mkdir -p "$TEST_VAULT"

echo -e "${GREEN}✅ 테스트 환경 준비 완료${NC}"
echo ""

# 3. MCP Inspector로 프로토콜 준수 검증
echo "3️⃣ MCP 프로토콜 준수 검증 (Inspector)..."
echo "   서버를 시작하고 Inspector로 연결합니다..."
echo ""

# Inspector 실행 (대화형 모드)
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/cli.js \
  --vault "$TEST_VAULT" \
  --index "$TEST_INDEX"

# 정리
echo ""
echo "🧹 테스트 환경 정리..."
rm -rf "$TEST_VAULT" "$TEST_INDEX"

echo ""
echo -e "${GREEN}✅ MCP 서버 검증 완료!${NC}"
