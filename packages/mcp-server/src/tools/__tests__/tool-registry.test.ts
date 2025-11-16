import { ErrorCode } from "@inchankang/zettel-memory-common";
import { executeTool, listTools, type ToolExecutionContext } from "..";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function createTestContext(): ToolExecutionContext {
  // Create temporary directory for test database
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-test-"));
  const indexPath = path.join(tempDir, "test-index.db");

  return {
    vaultPath: "/tmp/vault",
    indexPath,
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    policy: {
      maxRetries: 1,
      timeoutMs: 500,
    },
    mode: "dev",
  };
}

describe("tool registry", () => {
  it("exposes search_memory tool with validated schema", () => {
    const tools = listTools();
    const search = tools.find((tool) => tool.name === "search_memory");

    expect(search).toBeDefined();
    expect(search?.inputSchema).toBeDefined();
    const schemaDefinition =
      search?.inputSchema &&
      "definitions" in search.inputSchema &&
      typeof search.inputSchema.definitions === "object"
        ? (search.inputSchema.definitions as Record<string, any>)
            .search_memory
        : undefined;

    expect(schemaDefinition?.properties?.query).toMatchObject({
      type: "string",
    });
    expect(schemaDefinition?.required).toContain("query");
  });

  // TODO: Fix IndexSearchEngine initialization in tests
  it.skip("executes search_memory tool and returns search results", async () => {
    const context = createTestContext();
    const result = await executeTool(
      "search_memory",
      { query: "zettelkasten" },
      context
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: "text",
    });
    // Should mention the query even if no results found
    expect(result.content[0]!.text).toContain("zettelkasten");
    // Should have metadata with search metrics
    expect(result._meta?.metadata).toHaveProperty("query", "zettelkasten");
    expect(result._meta?.metadata).toHaveProperty("totalResults");
    expect(result._meta?.metadata).toHaveProperty("searchTimeMs");
  });

  it("validates input and throws schema validation errors", async () => {
    const context = createTestContext();

    await expect(
      executeTool(
        "create_note",
        { title: "제목만 있습니다" },
        context
      )
    ).rejects.toMatchObject({ code: ErrorCode.SCHEMA_VALIDATION_ERROR });
  });

  describe("Claude Desktop 호환성: 문자열 배열 전처리", () => {
    it("tags가 문자열로 전달되면 배열로 파싱", async () => {
      const context = createTestContext();

      // Claude Desktop이 tags를 문자열로 보내는 경우
      const input = {
        title: "테스트 노트 1",
        content: "테스트 내용입니다.",
        category: "Resources",
        tags: '["test", "mcp"]', // 문자열로 된 배열
      };

      // 스키마 검증을 통과하고 노트 생성 성공
      const result = await executeTool("create_note", input, context);
      expect(result.content[0]?.text).toContain("노트가 생성되었습니다");
      const metadata = result._meta?.metadata as Record<string, unknown>;
      expect(metadata?.tags).toEqual(["test", "mcp"]);
    });

    it("links가 문자열로 전달되면 배열로 파싱", async () => {
      const context = createTestContext();

      const input = {
        title: "테스트 노트 2",
        content: "테스트 내용입니다.",
        links: '["note1", "note2"]', // 문자열로 된 배열
      };

      // 스키마 검증 통과 및 성공
      const result = await executeTool("create_note", input, context);
      expect(result.content[0]?.text).toContain("노트가 생성되었습니다");
    });

    it("이미 배열인 경우는 그대로 유지", async () => {
      const context = createTestContext();

      const input = {
        title: "테스트 노트 3",
        content: "테스트 내용입니다.",
        tags: ["test", "mcp"], // 이미 배열
        links: ["note1"], // 이미 배열
      };

      // 스키마 검증 통과 및 성공
      const result = await executeTool("create_note", input, context);
      expect(result.content[0]?.text).toContain("노트가 생성되었습니다");
      const metadata = result._meta?.metadata as Record<string, unknown>;
      expect(metadata?.tags).toEqual(["test", "mcp"]);
    });

    it("잘못된 JSON 문자열은 원래 값 유지 (스키마 에러)", async () => {
      const context = createTestContext();

      const input = {
        title: "테스트 노트",
        content: "테스트 내용입니다.",
        tags: 'invalid json [', // 파싱 불가능
      };

      // 스키마 검증 에러 발생
      await expect(
        executeTool("create_note", input, context)
      ).rejects.toMatchObject({ code: ErrorCode.SCHEMA_VALIDATION_ERROR });
    });
  });
});
