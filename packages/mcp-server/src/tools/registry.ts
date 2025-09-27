import {
  ErrorCode,
  MemoryMcpError,
  createLogEntry,
  maskSensitiveInfo,
} from "@memory-mcp/common";
import {
  createNewNote,
  saveNote,
} from "@memory-mcp/storage-md";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as path from "path";
import {
  CreateNoteInputSchema,
  SearchMemoryInputSchema,
  ToolName,
  ToolNameSchema,
  type CreateNoteInput,
  type SearchMemoryInput,
} from "./schemas.js";
import {
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolResult,
} from "./types.js";
import { DEFAULT_EXECUTION_POLICY, withExecutionPolicy, type ExecutionPolicyOptions } from "./execution-policy.js";

type JsonSchema = ReturnType<typeof zodToJsonSchema>;

const searchMemoryDefinition: ToolDefinition<typeof SearchMemoryInputSchema> = {
  name: "search_memory",
  description: "메모리 볼트에서 키워드를 검색합니다.",
  schema: SearchMemoryInputSchema,
  async handler(input: SearchMemoryInput): Promise<ToolResult> {
    const { query, limit = 10, category, tags = [] } = input;

    return {
      content: [
        {
          type: "text",
          text: `검색 기능은 아직 인덱스와 연동 중입니다.\n요청하신 쿼리: ${query}\n카테고리: ${category ?? "(지정되지 않음)"}\n태그: ${
            tags.join(", ") || "(없음)"
          }\n최대 결과 수: ${limit}`,
        },
      ],
      _meta: {
        metadata: {
          query,
          category: category ?? null,
          tags,
          limit,
        },
      },
    };
  },
};

const createNoteDefinition: ToolDefinition<typeof CreateNoteInputSchema> = {
  name: "create_note",
  description: "새로운 Markdown 노트를 생성합니다.",
  schema: CreateNoteInputSchema,
  async handler(input: CreateNoteInput, context: ToolExecutionContext): Promise<ToolResult> {
    const maskedContent = maskSensitiveInfo(input.content);

    context.logger.info(
      `[tool:create_note] 노트 생성 요청 수신`,
      createLogEntry("info", "create_note", {
        vaultPath: context.vaultPath,
        mode: context.mode,
        title: input.title,
      })
    );

    try {
      // 파일 경로 생성 (제목을 파일명으로 사용, 안전한 문자로 변환)
      const safeFileName = input.title
        .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거 (한글, 영문, 숫자, 공백만 허용)
        .replace(/\s+/g, '_') // 공백을 언더스코어로 변환
        .trim();

      const fileName = `${safeFileName}.md`;
      const filePath = path.join(context.vaultPath, input.category, fileName);

      // 노트 객체 생성
      const note = createNewNote(
        input.title,
        input.content,
        filePath,
        input.category,
        {
          tags: input.tags,
          project: input.project ?? undefined,
          links: input.links ?? [],
        }
      );

      // 실제 파일 저장
      await saveNote(note);

      const noteId = note.frontMatter.id;

      context.logger.info(
        `[tool:create_note] 노트 생성 완료: ${noteId}`,
        createLogEntry("info", "create_note.success", {
          id: noteId,
          filePath: note.filePath,
        })
      );

      return {
        content: [
          {
            type: "text",
            text: `노트가 성공적으로 생성되었습니다.\nID: ${noteId}\n제목: ${input.title}\n파일 경로: ${note.filePath}\n카테고리: ${input.category}\n태그: ${
              input.tags.join(", ") || "(없음)"
            }\n내용 미리보기: ${maskedContent.slice(0, 200)}${
              maskedContent.length > 200 ? "..." : ""
            }`,
          },
        ],
        _meta: {
          metadata: {
            id: noteId,
            title: input.title,
            category: input.category,
            tags: input.tags,
            project: input.project ?? null,
            links: input.links ?? [],
            filePath: note.filePath,
          },
        },
      };
    } catch (error) {
      context.logger.error(
        `[tool:create_note] 노트 생성 실패`,
        createLogEntry("error", "create_note.failure", {
          title: input.title,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      throw new MemoryMcpError(
        ErrorCode.MCP_TOOL_ERROR,
        `노트 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
        { title: input.title }
      );
    }
  },
};

type RegisteredTool =
  | typeof searchMemoryDefinition
  | typeof createNoteDefinition;

const toolMap: Record<ToolName, RegisteredTool> = {
  search_memory: searchMemoryDefinition,
  create_note: createNoteDefinition,
};

const toolDefinitions: RegisteredTool[] = Object.values(toolMap);

function toJsonSchema(definition: RegisteredTool): JsonSchema {
  return zodToJsonSchema(definition.schema, definition.name);
}

export function listTools(): Array<{
  name: ToolName;
  description: string;
  inputSchema: JsonSchema;
}> {
  return toolDefinitions.map((definition) => ({
    name: definition.name as ToolName,
    description: definition.description,
    inputSchema: toJsonSchema(definition),
  }));
}

async function executeToolWithDefinition(
  definition: RegisteredTool,
  rawInput: unknown,
  context: ToolExecutionContext,
  policy: ExecutionPolicyOptions
): Promise<ToolResult> {
  const parsedInput = await definition.schema.parseAsync(rawInput).catch((error: unknown) => {
    throw new MemoryMcpError(
      ErrorCode.SCHEMA_VALIDATION_ERROR,
      "툴 입력이 유효하지 않습니다.",
      {
        validationErrors: error instanceof Error ? error.message : error,
        tool: definition.name,
      }
    );
  });

  const startTime = Date.now();
  context.logger.debug(
    `[tool:${definition.name}] 실행 시작`,
    createLogEntry("debug", "tool.start", {
      name: definition.name,
      inputPreview: maskSensitiveInfo(JSON.stringify(parsedInput)).slice(0, 200),
    })
  );

  try {
    const result = await withExecutionPolicy<ToolResult>(
      () => definition.handler(parsedInput as any, context),
      {
        ...policy,
        onRetry: ({ attempt, error }) => {
          context.logger.warn(
            `[tool:${definition.name}] ${attempt}차 시도 실패`,
            createLogEntry("warn", "tool.retry", {
              attempt,
              error: error instanceof Error ? error.message : String(error),
              name: definition.name,
            })
          );
        },
      }
    );

    const duration = Date.now() - startTime;
    context.logger.info(
      `[tool:${definition.name}] 실행 완료 (${duration}ms)`,
      createLogEntry("info", "tool.success", {
        duration,
        name: definition.name,
      })
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    context.logger.error(
      `[tool:${definition.name}] 실행 실패 (${duration}ms)`,
      createLogEntry("error", "tool.failure", {
        duration,
        name: definition.name,
        error: error instanceof Error ? error.message : String(error),
      })
    );

    throw error;
  }
}

export async function executeTool(
  name: ToolName,
  rawInput: unknown,
  context: ToolExecutionContext,
  overrides?: Partial<ToolExecutionContext["policy"]>
): Promise<ToolResult> {
  const parseResult = ToolNameSchema.safeParse(name);
  if (!parseResult.success) {
    throw new MemoryMcpError(
      ErrorCode.MCP_INVALID_REQUEST,
      `알 수 없는 MCP 툴입니다: ${String(name)}`
    );
  }

  const definition = toolMap[parseResult.data];

  if (!definition) {
    throw new MemoryMcpError(
      ErrorCode.MCP_TOOL_ERROR,
      `등록되지 않은 MCP 툴입니다: ${parseResult.data}`
    );
  }

  const policy = {
    ...DEFAULT_EXECUTION_POLICY,
    ...context.policy,
    ...overrides,
  };

  return executeToolWithDefinition(definition, rawInput, context, policy);
}
