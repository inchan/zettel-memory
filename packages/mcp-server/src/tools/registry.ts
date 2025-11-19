/**
 * MCP Tool Registry - 도구 정의 및 실행
 */

import path from 'path';
import {
  ErrorCode,
  MemoryMcpError,
  createLogEntry,
  maskSensitiveInfo,
  generateUid,
  type Uid,
} from '@inchankang/zettel-memory-common';
import {
  createNewNote,
  saveNote,
  findNoteByUid,
  loadAllNotes,
  sanitizeFileName,
  normalizePath,
  generateNoteMetadata,
  analyzeLinks,
  updateFrontMatter,
  deleteFile,
} from '@inchankang/zettel-memory-storage-md';
import { IndexSearchEngine } from '@inchankang/zettel-memory-index-search';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CreateNoteInputSchema,
  ReadNoteInputSchema,
  ListNotesInputSchema,
  SearchMemoryInputSchema,
  UpdateNoteInputSchema,
  DeleteNoteInputSchema,
  GetVaultStatsInputSchema,
  GetBacklinksInputSchema,
  GetMetricsInputSchema,
  FindOrphanNotesInputSchema,
  FindStaleNotesInputSchema,
  GetOrganizationHealthInputSchema,
  ArchiveNotesInputSchema,
  SuggestLinksInputSchema,
  ToolName,
  ToolNameSchema,
  type CreateNoteInput,
  type ReadNoteInput,
  type ListNotesInput,
  type SearchMemoryInput,
  type UpdateNoteInput,
  type DeleteNoteInput,
  type GetVaultStatsInput,
  type GetBacklinksInput,
  type GetMetricsInput,
  type FindOrphanNotesInput,
  type FindStaleNotesInput,
  type GetOrganizationHealthInput,
  type ArchiveNotesInput,
  type SuggestLinksInput,
} from './schemas.js';
import {
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolResult,
} from './types.js';
import {
  DEFAULT_EXECUTION_POLICY,
  withExecutionPolicy,
} from './execution-policy.js';
import { IndexRecoveryQueue } from './index-recovery.js';
import { MetricsCollector } from './metrics.js';

type JsonSchema = ReturnType<typeof zodToJsonSchema>;

/**
 * IndexSearchEngine 인스턴스를 가져오거나 생성합니다.
 * DI 패턴: context에서 인스턴스를 관리하여 테스트 격리 및 리소스 정리 개선
 */
function getSearchEngine(context: ToolExecutionContext): IndexSearchEngine {
  if (!context._searchEngineInstance) {
    context._searchEngineInstance = new IndexSearchEngine({
      dbPath: context.indexPath,
      tokenizer: 'unicode61',
      walMode: true,
    });
    context.logger.info('IndexSearchEngine 인스턴스 생성됨', {
      dbPath: context.indexPath,
    });
  }
  return context._searchEngineInstance;
}

/**
 * IndexRecoveryQueue 인스턴스를 가져오거나 생성합니다.
 */
function getRecoveryQueue(context: ToolExecutionContext): IndexRecoveryQueue {
  if (!context._recoveryQueue) {
    context._recoveryQueue = new IndexRecoveryQueue(getSearchEngine, context);
    context.logger.debug('IndexRecoveryQueue 인스턴스 생성됨');
  }
  return context._recoveryQueue;
}

/**
 * MetricsCollector 인스턴스를 가져오거나 생성합니다.
 */
function getMetricsCollector(context: ToolExecutionContext): MetricsCollector {
  if (!context._metricsCollector) {
    context._metricsCollector = new MetricsCollector();
    context.logger.debug('MetricsCollector 인스턴스 생성됨');
  }
  return context._metricsCollector;
}

/**
 * 검색 엔진 및 복구 큐를 정리합니다.
 * 서버 종료 시 또는 테스트 정리 시 리소스 정리를 위해 호출됩니다.
 * @param context - 정리할 context (없으면 모든 context 정리 시도)
 */
export function cleanupSearchEngine(context?: ToolExecutionContext): void {
  // 복구 큐 정리
  if (context?._recoveryQueue) {
    try {
      context._recoveryQueue.cleanup();
      delete context._recoveryQueue;
      context.logger?.debug('IndexRecoveryQueue 정리 완료');
    } catch {
      // 정리 중 에러는 무시
    }
  }

  // SearchEngine 정리
  if (context?._searchEngineInstance) {
    try {
      context._searchEngineInstance.close();
      delete context._searchEngineInstance;
      context.logger?.debug('SearchEngine 인스턴스 정리 완료');
    } catch {
      // 정리 중 에러는 무시 (서버 종료 시이므로)
    }
  }
}

/**
 * Helper: 파일 경로 생성
 */
function generateFilePath(
  vaultPath: string,
  title: string,
  uid: string
): string {
  const sanitizedTitle = sanitizeFileName(title).toLowerCase().slice(0, 50);
  const fileName = `${sanitizedTitle}-${uid}.md`;
  return normalizePath(path.join(vaultPath, fileName));
}

/**
 * Tool: search_memory (FTS5 기반 전문 검색)
 */
const searchMemoryDefinition: ToolDefinition<typeof SearchMemoryInputSchema> = {
  name: 'search_memory',
  description:
    '메모리 볼트에서 FTS5 기반 전문 검색을 수행합니다. 키워드, 카테고리, 태그로 필터링할 수 있습니다.',
  schema: SearchMemoryInputSchema,
  async handler(
    input: SearchMemoryInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { query, limit = 10, category, tags = [] } = input;

    try {
      const searchEngine = getSearchEngine(context);

      // 검색 옵션 구성 (exactOptionalPropertyTypes 고려)
      const searchOptions: {
        limit: number;
        category?: string;
        tags?: string[];
      } = {
        limit,
      };
      if (category) {
        searchOptions.category = category;
      }
      if (tags.length > 0) {
        searchOptions.tags = tags;
      }

      // 전문 검색 수행
      const searchResult = await searchEngine.search(query, searchOptions);

      // 결과가 없는 경우
      if (searchResult.results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `검색 결과가 없습니다.

검색 쿼리: ${query}
카테고리 필터: ${category ?? '(없음)'}
태그 필터: ${tags.join(', ') || '(없음)'}

힌트: 다른 키워드를 시도하거나 필터 조건을 완화해보세요.`,
            },
          ],
          _meta: {
            metadata: {
              query,
              category: category ?? null,
              tags,
              limit,
              totalResults: 0,
              searchTimeMs: searchResult.metrics.totalTimeMs,
            },
          },
        };
      }

      // 결과를 텍스트로 포맷팅
      const resultsText = searchResult.results
        .map((result: any, index: number) => {
          return `${index + 1}. **${result.title}** (${result.category})
   ID: ${result.id}
   Score: ${result.score.toFixed(2)}
   Tags: ${result.tags.join(', ') || '(없음)'}
   Path: ${result.filePath}

   ${result.snippet}

   Links: ${result.links.length > 0 ? result.links.join(', ') : '(없음)'}`;
        })
        .join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `검색 완료: "${query}"

총 ${searchResult.totalCount}개 결과 중 ${searchResult.results.length}개 표시
검색 시간: ${searchResult.metrics.totalTimeMs.toFixed(2)}ms

${resultsText}`,
          },
        ],
        _meta: {
          metadata: {
            query,
            category: category ?? null,
            tags,
            limit,
            totalResults: searchResult.totalCount,
            returnedResults: searchResult.results.length,
            searchTimeMs: searchResult.metrics.totalTimeMs,
            metrics: searchResult.metrics,
          },
        },
      };
    } catch (error) {
      context.logger.error('검색 중 오류 발생', { error, query });
      throw new MemoryMcpError(
        ErrorCode.INTERNAL_ERROR,
        `검색 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
        { query, category, tags }
      );
    }
  },
};

/**
 * Tool: create_note
 */
const createNoteDefinition: ToolDefinition<typeof CreateNoteInputSchema> = {
  name: 'create_note',
  description: '새로운 Markdown 노트를 생성합니다.',
  schema: CreateNoteInputSchema,
  async handler(
    input: CreateNoteInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { title, content, category, tags, project, links } = input;

    try {
      // Generate UID (한 번만 생성하여 파일명과 노트 ID에 동일하게 사용)
      const uid = generateUid();

      // Generate file path
      const filePath = generateFilePath(context.vaultPath, title, uid);

      context.logger.debug(
        `[tool:create_note] 노트 생성 시작`,
        createLogEntry('debug', 'create_note.start', {
          title,
          category,
          uid,
        })
      );

      // Create note object (생성된 UID를 명시적으로 전달하여 이중 생성 방지)
      const note = createNewNote(title, content, filePath, category, {
        id: uid, // 파일명과 동일한 UID 사용
        tags,
        project,
        links: links || [],
      });

      // Save to file
      await saveNote(note);

      // 검색 인덱스에 새 노트 추가
      let indexingSuccess = true;
      let indexingWarning = '';
      try {
        const searchEngine = getSearchEngine(context);
        searchEngine.indexNote(note);
        context.logger.debug(`[tool:create_note] 검색 인덱스 업데이트 완료`, {
          uid,
        });
      } catch (indexError) {
        // 인덱스 업데이트 실패 시 복구 큐에 추가
        indexingSuccess = false;
        indexingWarning =
          '\n\n⚠️ 검색 인덱스 업데이트 실패: 백그라운드에서 재시도됩니다.';

        const recoveryQueue = getRecoveryQueue(context);
        recoveryQueue.enqueue({
          operation: 'index',
          noteUid: uid,
          noteFilePath: note.filePath,
        });

        context.logger.warn(
          `[tool:create_note] 검색 인덱스 업데이트 실패, 복구 큐에 추가됨`,
          { uid, error: indexError }
        );
      }

      context.logger.info(
        `[tool:create_note] 노트 생성 완료: ${uid}`,
        createLogEntry('info', 'create_note.success', {
          uid: note.frontMatter.id,
          title: note.frontMatter.title,
          filePath: note.filePath,
          indexingSuccess,
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: `✓ 노트가 생성되었습니다.

**ID**: ${note.frontMatter.id}
**제목**: ${note.frontMatter.title}
**카테고리**: ${note.frontMatter.category || '(없음)'}
**태그**: ${note.frontMatter.tags.join(', ') || '(없음)'}
**프로젝트**: ${note.frontMatter.project || '(없음)'}
**파일**: ${path.basename(note.filePath)}
**생성 시간**: ${note.frontMatter.created}${indexingWarning}`,
          },
        ],
        _meta: {
          metadata: {
            id: note.frontMatter.id,
            title: note.frontMatter.title,
            category: note.frontMatter.category || null,
            tags: note.frontMatter.tags,
            project: note.frontMatter.project || null,
            filePath: note.filePath,
            created: note.frontMatter.created,
            indexingSuccess,
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(
        `[tool:create_note] 노트 생성 실패`,
        createLogEntry('error', 'create_note.error', {
          title,
          error: errorMessage,
        })
      );

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 생성 실패: ${errorMessage}`,
        { title, category }
      );
    }
  },
};

/**
 * Tool: read_note
 */
const readNoteDefinition: ToolDefinition<typeof ReadNoteInputSchema> = {
  name: 'read_note',
  description:
    'UID로 노트를 조회합니다. 옵션으로 메타데이터와 링크 분석을 포함할 수 있습니다.',
  schema: ReadNoteInputSchema,
  async handler(
    input: ReadNoteInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uid, includeMetadata = false, includeLinks = false } = input;

    try {
      context.logger.debug(
        `[tool:read_note] 노트 조회 시작: ${uid}`,
        createLogEntry('debug', 'read_note.start', { uid })
      );

      // Find note by UID
      const note = await findNoteByUid(uid as Uid, context.vaultPath);

      if (!note) {
        throw new MemoryMcpError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `UID에 해당하는 노트를 찾을 수 없습니다: ${uid}`,
          { uid }
        );
      }

      // Build response text
      let responseText = `# ${note.frontMatter.title}

**ID**: ${note.frontMatter.id}
**카테고리**: ${note.frontMatter.category || '(없음)'}
**태그**: ${note.frontMatter.tags.join(', ') || '(없음)'}
**프로젝트**: ${note.frontMatter.project || '(없음)'}
**생성**: ${note.frontMatter.created}
**수정**: ${note.frontMatter.updated}
**링크**: ${note.frontMatter.links.join(', ') || '(없음)'}

---

${note.content}`;

      // Build metadata
      const metadata: any = {
        id: note.frontMatter.id,
        title: note.frontMatter.title,
        category: note.frontMatter.category || null,
        tags: note.frontMatter.tags,
        project: note.frontMatter.project || null,
        created: note.frontMatter.created,
        updated: note.frontMatter.updated,
        links: note.frontMatter.links,
        filePath: note.filePath,
      };

      // Optional: Include metadata
      if (includeMetadata) {
        try {
          const noteMetadata = await generateNoteMetadata(note);
          metadata.fileSize = noteMetadata.fileSize;
          metadata.wordCount = noteMetadata.wordCount;
          metadata.characterCount = noteMetadata.characterCount;

          responseText += `

---
**메타데이터**:
- 파일 크기: ${(noteMetadata.fileSize / 1024).toFixed(2)} KB
- 단어 수: ${noteMetadata.wordCount}
- 문자 수: ${noteMetadata.characterCount}`;
        } catch (error) {
          context.logger.warn(`[tool:read_note] 메타데이터 생성 실패`, error);
        }
      }

      // Optional: Include link analysis
      if (includeLinks) {
        try {
          const linkAnalysis = await analyzeLinks(note, context.vaultPath);
          metadata.linkAnalysis = {
            outboundLinks: linkAnalysis.outboundLinks,
            inboundLinksCount: linkAnalysis.inboundLinks.length,
            brokenLinks: linkAnalysis.brokenLinks,
          };

          responseText += `

---
**링크 분석**:
- 아웃바운드 링크: ${linkAnalysis.outboundLinks.length}개
- 백링크: ${linkAnalysis.inboundLinks.length}개
- 깨진 링크: ${linkAnalysis.brokenLinks.length}개`;

          if (linkAnalysis.inboundLinks.length > 0) {
            responseText += `\n\n**백링크 목록**:\n`;
            linkAnalysis.inboundLinks.forEach((bl: any) => {
              responseText += `- [${bl.sourceTitle}](${bl.sourceUid})\n`;
            });
          }
        } catch (error) {
          context.logger.warn(`[tool:read_note] 링크 분석 실패`, error);
        }
      }

      context.logger.info(
        `[tool:read_note] 노트 조회 완료: ${uid}`,
        createLogEntry('info', 'read_note.success', { uid })
      );

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: { metadata },
      };
    } catch (error) {
      if (error instanceof MemoryMcpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(
        `[tool:read_note] 노트 조회 실패: ${uid}`,
        createLogEntry('error', 'read_note.error', { uid, error: errorMessage })
      );

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 조회 실패: ${errorMessage}`,
        { uid }
      );
    }
  },
};

/**
 * Tool: list_notes
 */
const listNotesDefinition: ToolDefinition<typeof ListNotesInputSchema> = {
  name: 'list_notes',
  description:
    '볼트의 노트 목록을 조회합니다. 카테고리, 태그, 프로젝트로 필터링할 수 있습니다.',
  schema: ListNotesInputSchema,
  async handler(
    input: ListNotesInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const {
      category,
      tags,
      project,
      limit = 100,
      offset = 0,
      sortBy = 'updated',
      sortOrder = 'desc',
    } = input;

    try {
      context.logger.debug(
        `[tool:list_notes] 목록 조회 시작`,
        createLogEntry('debug', 'list_notes.start', {
          filters: { category, tags, project },
        })
      );

      // Load all notes
      const allNotes = await loadAllNotes(context.vaultPath, {
        skipInvalid: true,
        concurrency: 20,
      });

      context.logger.debug(
        `[tool:list_notes] 전체 노트 로드 완료: ${allNotes.length}개`,
        createLogEntry('debug', 'list_notes.loaded', { total: allNotes.length })
      );

      // Apply filters
      let filteredNotes = allNotes;

      if (category) {
        filteredNotes = filteredNotes.filter(
          (note: any) => note.frontMatter.category === category
        );
      }

      if (tags && tags.length > 0) {
        filteredNotes = filteredNotes.filter((note: any) =>
          tags.some((tag: string) => note.frontMatter.tags.includes(tag))
        );
      }

      if (project) {
        filteredNotes = filteredNotes.filter(
          (note: any) => note.frontMatter.project === project
        );
      }

      // Sort
      filteredNotes.sort((a: any, b: any) => {
        let aValue: string;
        let bValue: string;

        switch (sortBy) {
          case 'created':
            aValue = a.frontMatter.created;
            bValue = b.frontMatter.created;
            break;
          case 'updated':
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
            break;
          case 'title':
            aValue = a.frontMatter.title.toLowerCase();
            bValue = b.frontMatter.title.toLowerCase();
            break;
          default:
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
        }

        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      const total = filteredNotes.length;

      // Apply pagination
      const paginatedNotes = filteredNotes.slice(offset, offset + limit);

      // Build response
      const notesList = paginatedNotes.map((note: any) => ({
        id: note.frontMatter.id,
        title: note.frontMatter.title,
        category: note.frontMatter.category,
        tags: note.frontMatter.tags,
        project: note.frontMatter.project || null,
        created: note.frontMatter.created,
        updated: note.frontMatter.updated,
        linkCount: note.frontMatter.links.length,
      }));

      let responseText = `# 노트 목록

**전체**: ${total}개
**표시**: ${paginatedNotes.length}개 (${offset + 1} - ${offset + paginatedNotes.length})
**정렬**: ${sortBy} (${sortOrder})
`;

      if (category || tags || project) {
        responseText += `\n**필터**:\n`;
        if (category) responseText += `- 카테고리: ${category}\n`;
        if (tags && tags.length > 0)
          responseText += `- 태그: ${tags.join(', ')}\n`;
        if (project) responseText += `- 프로젝트: ${project}\n`;
      }

      responseText += `\n---\n\n`;

      paginatedNotes.forEach((note: any, index: number) => {
        responseText += `${offset + index + 1}. **${note.frontMatter.title}**
   - ID: \`${note.frontMatter.id}\`
   - 카테고리: ${note.frontMatter.category || '(없음)'}
   - 태그: ${note.frontMatter.tags.join(', ') || '(없음)'}
   - 업데이트: ${note.frontMatter.updated}
   - 링크: ${note.frontMatter.links.length}개

`;
      });

      if (offset + limit < total) {
        responseText += `\n⋯ 더 많은 결과가 있습니다. offset=${offset + limit}로 다음 페이지를 확인하세요.`;
      }

      context.logger.info(
        `[tool:list_notes] 목록 조회 완료`,
        createLogEntry('info', 'list_notes.success', {
          total,
          filtered: paginatedNotes.length,
          filters: { category, tags, project },
        })
      );

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            total,
            offset,
            limit,
            returned: paginatedNotes.length,
            hasMore: offset + limit < total,
            filters: { category, tags, project },
            sortBy,
            sortOrder,
            notes: notesList,
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(
        `[tool:list_notes] 목록 조회 실패`,
        createLogEntry('error', 'list_notes.error', { error: errorMessage })
      );

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 목록 조회 실패: ${errorMessage}`,
        { filters: { category, tags, project } }
      );
    }
  },
};

/**
 * Tool: update_note
 */
const updateNoteDefinition: ToolDefinition<typeof UpdateNoteInputSchema> = {
  name: 'update_note',
  description:
    '기존 노트를 업데이트합니다. 제목, 내용, 카테고리, 태그, 프로젝트, 링크를 수정할 수 있습니다.',
  schema: UpdateNoteInputSchema,
  async handler(
    input: UpdateNoteInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uid, title, content, category, tags, project, links } = input;

    try {
      context.logger.debug(`[tool:update_note] 노트 업데이트 시작`, { uid });

      // 1. 노트 파일 찾기
      const noteResult = await findNoteByUid(uid, context.vaultPath);
      if (!noteResult) {
        throw new MemoryMcpError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `UID에 해당하는 노트를 찾을 수 없습니다: ${uid}`,
          { uid }
        );
      }

      // 2. 노트 로드 (findNoteByUid가 이미 노트를 반환함)
      const existingNote = noteResult;

      // 3. Front Matter 업데이트 (exactOptionalPropertyTypes 고려)
      const frontMatterUpdates: any = {};
      if (title !== undefined) frontMatterUpdates.title = title;
      if (category !== undefined) frontMatterUpdates.category = category;
      if (tags !== undefined) frontMatterUpdates.tags = tags;
      if (project !== undefined) {
        frontMatterUpdates.project = project === null ? undefined : project;
      }
      if (links !== undefined) frontMatterUpdates.links = links;

      const updatedFrontMatter = updateFrontMatter(
        existingNote.frontMatter,
        frontMatterUpdates
      );

      // 4. 업데이트된 노트 구성
      const updatedNote = {
        ...existingNote,
        frontMatter: updatedFrontMatter,
        content: content !== undefined ? content : existingNote.content,
      };

      // 5. 저장
      await saveNote(updatedNote);

      // 6. 검색 인덱스 업데이트
      try {
        const searchEngine = getSearchEngine(context);
        searchEngine.indexNote(updatedNote);
        context.logger.debug(`[tool:update_note] 검색 인덱스 업데이트 완료`, {
          uid,
        });
      } catch (indexError) {
        // 인덱스 업데이트 실패 시 복구 큐에 추가
        const recoveryQueue = getRecoveryQueue(context);
        recoveryQueue.enqueue({
          operation: 'update',
          noteUid: uid,
          noteFilePath: updatedNote.filePath,
        });

        context.logger.warn(
          `[tool:update_note] 검색 인덱스 업데이트 실패, 복구 큐에 추가됨`,
          { uid, error: indexError }
        );
      }

      context.logger.info(`[tool:update_note] 노트 업데이트 완료`, {
        uid,
        title: updatedNote.frontMatter.title,
      });

      // 7. 응답 생성
      const updatedFields: string[] = [];
      if (title) updatedFields.push('제목');
      if (content !== undefined) updatedFields.push('내용');
      if (category) updatedFields.push('카테고리');
      if (tags) updatedFields.push('태그');
      if (project !== undefined) updatedFields.push('프로젝트');
      if (links) updatedFields.push('링크');

      return {
        content: [
          {
            type: 'text',
            text: `노트가 성공적으로 업데이트되었습니다.

**UID**: ${uid}
**제목**: ${updatedNote.frontMatter.title}
**카테고리**: ${updatedNote.frontMatter.category || '(없음)'}
**태그**: ${updatedNote.frontMatter.tags.join(', ') || '(없음)'}
**프로젝트**: ${updatedNote.frontMatter.project || '(없음)'}
**링크**: ${updatedNote.frontMatter.links.length}개
**업데이트 시간**: ${updatedNote.frontMatter.updated}

**업데이트된 필드**: ${updatedFields.join(', ')}`,
          },
        ],
        _meta: {
          metadata: {
            uid,
            title: updatedNote.frontMatter.title,
            category: updatedNote.frontMatter.category || null,
            tags: updatedNote.frontMatter.tags,
            project: updatedNote.frontMatter.project || null,
            updated: updatedNote.frontMatter.updated,
            updatedFields,
          },
        },
      };
    } catch (error) {
      if (error instanceof MemoryMcpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.logger.error(`[tool:update_note] 노트 업데이트 실패`, {
        uid,
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 업데이트 실패: ${errorMessage}`,
        { uid }
      );
    }
  },
};

/**
 * Tool: delete_note
 */
const deleteNoteDefinition: ToolDefinition<typeof DeleteNoteInputSchema> = {
  name: 'delete_note',
  description:
    '노트를 삭제합니다. 삭제는 되돌릴 수 없으므로 confirm=true를 명시적으로 전달해야 합니다.',
  schema: DeleteNoteInputSchema,
  async handler(
    input: DeleteNoteInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uid, confirm } = input;

    // confirm 체크 (스키마에서도 체크하지만 이중 확인)
    if (!confirm) {
      throw new MemoryMcpError(
        ErrorCode.SCHEMA_VALIDATION_ERROR,
        '노트 삭제를 확인하려면 confirm=true를 전달해야 합니다.',
        { uid }
      );
    }

    try {
      context.logger.debug(`[tool:delete_note] 노트 삭제 시작`, { uid });

      // 1. 노트 파일 찾기
      const noteToDelete = await findNoteByUid(uid, context.vaultPath);
      if (!noteToDelete) {
        throw new MemoryMcpError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `UID에 해당하는 노트를 찾을 수 없습니다: ${uid}`,
          { uid }
        );
      }

      // 2. 노트 정보 추출 (응답용)
      const noteInfo = {
        uid: noteToDelete.frontMatter.id,
        title: noteToDelete.frontMatter.title,
        category: noteToDelete.frontMatter.category,
        filePath: noteToDelete.filePath,
      };

      // 3. 파일 삭제
      await deleteFile(noteToDelete.filePath);

      // 4. 검색 인덱스에서 제거
      try {
        const searchEngine = getSearchEngine(context);
        searchEngine.removeNote(uid);
        context.logger.debug(`[tool:delete_note] 검색 인덱스 삭제 완료`, {
          uid,
        });
      } catch (indexError) {
        // 인덱스 삭제 실패 시 복구 큐에 추가
        const recoveryQueue = getRecoveryQueue(context);
        recoveryQueue.enqueue({
          operation: 'delete',
          noteUid: uid,
        });

        context.logger.warn(
          `[tool:delete_note] 검색 인덱스 삭제 실패, 복구 큐에 추가됨`,
          { uid, error: indexError }
        );
      }

      context.logger.info(`[tool:delete_note] 노트 삭제 완료`, noteInfo);

      return {
        content: [
          {
            type: 'text',
            text: `노트가 성공적으로 삭제되었습니다.

**UID**: ${noteInfo.uid}
**제목**: ${noteInfo.title}
**카테고리**: ${noteInfo.category}
**파일 경로**: ${noteInfo.filePath}

⚠️ 이 작업은 되돌릴 수 없습니다.`,
          },
        ],
        _meta: {
          metadata: {
            ...noteInfo,
            deletedAt: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof MemoryMcpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.logger.error(`[tool:delete_note] 노트 삭제 실패`, {
        uid,
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 삭제 실패: ${errorMessage}`,
        { uid }
      );
    }
  },
};

/**
 * Tool: get_vault_stats
 */
const getVaultStatsDefinition: ToolDefinition<typeof GetVaultStatsInputSchema> =
  {
    name: 'get_vault_stats',
    description:
      '볼트의 통계 정보를 조회합니다. 노트 수, 카테고리별 분포, 태그 사용 현황, 링크 통계 등을 제공합니다.',
    schema: GetVaultStatsInputSchema,
    async handler(
      input: GetVaultStatsInput,
      context: ToolExecutionContext
    ): Promise<ToolResult> {
      const {
        includeCategories = true,
        includeTagStats = true,
        includeLinkStats = true,
      } = input;

      try {
        context.logger.debug(`[tool:get_vault_stats] 통계 조회 시작`);

        const notes = await loadAllNotes(context.vaultPath);

        // 기본 통계
        const totalNotes = notes.length;
        const totalWords = notes.reduce(
          (sum, note) => sum + note.content.split(/\s+/).length,
          0
        );

        // 카테고리별 통계
        const categoryStats: Record<string, number> = {};
        if (includeCategories) {
          for (const note of notes) {
            const category = note.frontMatter.category || 'Uncategorized';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
          }
        }

        // 태그 통계
        const tagStats: Record<string, number> = {};
        if (includeTagStats) {
          for (const note of notes) {
            for (const tag of note.frontMatter.tags) {
              tagStats[tag] = (tagStats[tag] || 0) + 1;
            }
          }
        }

        // 링크 통계
        let linkStats = {};
        if (includeLinkStats) {
          const totalLinks = notes.reduce(
            (sum, note) => sum + note.frontMatter.links.length,
            0
          );
          const orphanNotes = notes.filter(
            note =>
              note.frontMatter.links.length === 0 &&
              !notes.some(other =>
                other.frontMatter.links.includes(note.frontMatter.id)
              )
          ).length;

          linkStats = {
            totalLinks,
            orphanNotes,
            avgLinksPerNote:
              totalNotes > 0 ? (totalLinks / totalNotes).toFixed(2) : '0',
          };
        }

        const stats = {
          totalNotes,
          totalWords,
          avgWordsPerNote:
            totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0,
          ...(includeCategories && { categoryStats }),
          ...(includeTagStats && {
            tagStats,
            uniqueTags: Object.keys(tagStats).length,
          }),
          ...(includeLinkStats && { linkStats }),
        };

        context.logger.info(`[tool:get_vault_stats] 통계 조회 완료`, {
          totalNotes,
        });

        return {
          content: [
            {
              type: 'text',
              text: `## 볼트 통계

**총 노트 수**: ${totalNotes}개
**총 단어 수**: ${totalWords.toLocaleString()}개
**노트당 평균 단어**: ${stats.avgWordsPerNote}개

${
  includeCategories
    ? `### 카테고리별 분포
${Object.entries(categoryStats)
  .map(([k, v]) => `- ${k}: ${v}개`)
  .join('\n')}`
    : ''
}

${
  includeTagStats
    ? `### 태그 통계
- 고유 태그: ${Object.keys(tagStats).length}개
- 상위 태그: ${Object.entries(tagStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}(${v})`)
        .join(', ')}`
    : ''
}

${
  includeLinkStats
    ? `### 링크 통계
- 총 링크: ${(linkStats as any).totalLinks}개
- 고아 노트: ${(linkStats as any).orphanNotes}개
- 노트당 평균 링크: ${(linkStats as any).avgLinksPerNote}개`
    : ''
}`,
            },
          ],
          _meta: { metadata: stats },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        context.logger.error(`[tool:get_vault_stats] 통계 조회 실패`, {
          error: errorMessage,
        });
        throw new MemoryMcpError(
          ErrorCode.FILE_READ_ERROR,
          `통계 조회 실패: ${errorMessage}`
        );
      }
    },
  };

/**
 * Tool: get_backlinks
 */
const getBacklinksDefinition: ToolDefinition<typeof GetBacklinksInputSchema> = {
  name: 'get_backlinks',
  description: '특정 노트를 참조하는 다른 노트들(백링크)을 찾습니다.',
  schema: GetBacklinksInputSchema,
  async handler(
    input: GetBacklinksInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uid, limit = 20 } = input;

    try {
      context.logger.debug(`[tool:get_backlinks] 백링크 조회 시작`, { uid });

      // 대상 노트 확인
      const targetNote = await findNoteByUid(uid, context.vaultPath);
      if (!targetNote) {
        throw new MemoryMcpError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `UID에 해당하는 노트를 찾을 수 없습니다: ${uid}`,
          { uid }
        );
      }

      // 모든 노트 로드 후 백링크 찾기
      const allNotes = await loadAllNotes(context.vaultPath);
      const backlinks = allNotes
        .filter(note => note.frontMatter.links.includes(uid))
        .slice(0, limit)
        .map(note => ({
          uid: note.frontMatter.id,
          title: note.frontMatter.title,
          category: note.frontMatter.category,
          snippet:
            note.content.slice(0, 150) +
            (note.content.length > 150 ? '...' : ''),
        }));

      context.logger.info(`[tool:get_backlinks] 백링크 조회 완료`, {
        uid,
        backlinksCount: backlinks.length,
      });

      if (backlinks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `**${targetNote.frontMatter.title}** (${uid})를 참조하는 노트가 없습니다.`,
            },
          ],
          _meta: { metadata: { uid, backlinks: [], count: 0 } },
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `## ${targetNote.frontMatter.title} 백링크

**${backlinks.length}개의 노트가 이 노트를 참조합니다:**

${backlinks
  .map(
    bl => `### ${bl.title}
- **UID**: ${bl.uid}
- **카테고리**: ${bl.category}
- **내용 미리보기**: ${bl.snippet}`
  )
  .join('\n\n')}`,
          },
        ],
        _meta: { metadata: { uid, backlinks, count: backlinks.length } },
      };
    } catch (error) {
      if (error instanceof MemoryMcpError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.logger.error(`[tool:get_backlinks] 백링크 조회 실패`, {
        uid,
        error: errorMessage,
      });
      throw new MemoryMcpError(
        ErrorCode.FILE_READ_ERROR,
        `백링크 조회 실패: ${errorMessage}`
      );
    }
  },
};

/**
 * Tool: get_metrics
 */
const getMetricsDefinition: ToolDefinition<typeof GetMetricsInputSchema> = {
  name: 'get_metrics',
  description:
    '시스템 메트릭을 조회합니다. 도구 실행 통계, 성능 지표 등을 제공합니다.',
  schema: GetMetricsInputSchema,
  async handler(
    input: GetMetricsInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { format = 'json', reset = false } = input;

    try {
      context.logger.debug(`[tool:get_metrics] 메트릭 조회`, { format, reset });

      const metrics = getMetricsCollector(context);
      const summary = metrics.getSummary();

      if (reset) {
        metrics.reset();
        context.logger.info(`[tool:get_metrics] 메트릭 초기화됨`);
      }

      if (format === 'prometheus') {
        return {
          content: [
            {
              type: 'text',
              text: metrics.toPrometheusFormat(),
            },
          ],
          _meta: { metadata: { format: 'prometheus', reset } },
        };
      }

      // JSON format - return actual JSON for machine readability
      if (reset) {
        return {
          content: [
            {
              type: 'text',
              text:
                JSON.stringify(summary, null, 2) +
                '\n\n메트릭이 초기화되었습니다.',
            },
          ],
          _meta: { metadata: { ...summary, reset } },
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
        _meta: { metadata: { ...summary, reset } },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.logger.error(`[tool:get_metrics] 메트릭 조회 실패`, {
        error: errorMessage,
      });
      throw new MemoryMcpError(
        ErrorCode.MCP_TOOL_ERROR,
        `메트릭 조회 실패: ${errorMessage}`
      );
    }
  },
};

/**
 * Tool: find_orphan_notes
 */
const findOrphanNotesDefinition: ToolDefinition<
  typeof FindOrphanNotesInputSchema
> = {
  name: 'find_orphan_notes',
  description:
    '아웃바운드 링크와 인바운드 링크가 모두 없는 고아 노트를 찾습니다. 노트 정리 및 조직화에 유용합니다.',
  schema: FindOrphanNotesInputSchema,
  async handler(
    input: FindOrphanNotesInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const {
      limit = 100,
      category,
      sortBy = 'updated',
      sortOrder = 'desc',
    } = input;

    try {
      context.logger.debug(`[tool:find_orphan_notes] 고아 노트 검색 시작`);

      // 모든 노트 로드
      const allNotes = await loadAllNotes(context.vaultPath, {
        skipInvalid: true,
        concurrency: 20,
      });

      // 링크 맵 생성 (아웃바운드 링크 추적)
      const linkedFrom = new Set<string>(); // 다른 노트로 링크를 보내는 노트
      const linkedTo = new Set<string>(); // 다른 노트로부터 링크를 받는 노트

      for (const note of allNotes) {
        const uid = note.frontMatter.id;
        const links = note.frontMatter.links || [];

        if (links.length > 0) {
          linkedFrom.add(uid);
          for (const link of links) {
            linkedTo.add(link);
          }
        }
      }

      // 고아 노트 필터링 (아웃바운드도 없고 인바운드도 없는 노트)
      let orphanNotes = allNotes.filter(note => {
        const uid = note.frontMatter.id;
        return !linkedFrom.has(uid) && !linkedTo.has(uid);
      });

      // 카테고리 필터 적용
      if (category) {
        orphanNotes = orphanNotes.filter(
          note => note.frontMatter.category === category
        );
      }

      // 정렬
      orphanNotes.sort((a: any, b: any) => {
        let aValue: string;
        let bValue: string;

        switch (sortBy) {
          case 'created':
            aValue = a.frontMatter.created;
            bValue = b.frontMatter.created;
            break;
          case 'updated':
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
            break;
          case 'title':
            aValue = a.frontMatter.title.toLowerCase();
            bValue = b.frontMatter.title.toLowerCase();
            break;
          default:
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
        }

        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      const totalCount = orphanNotes.length;
      const paginatedNotes = orphanNotes.slice(0, limit);

      // 결과가 없는 경우
      if (paginatedNotes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `## 고아 노트 검색 결과

고아 노트가 없습니다.${category ? `\n\n카테고리 필터: ${category}` : ''}

모든 노트가 잘 연결되어 있습니다! 🎉`,
            },
          ],
          _meta: {
            metadata: {
              totalCount: 0,
              returnedCount: 0,
              category: category ?? null,
            },
          },
        };
      }

      // 결과 포맷팅
      const notesList = paginatedNotes.map((note: any, index: number) => {
        return `${index + 1}. **${note.frontMatter.title}**
   - ID: \`${note.frontMatter.id}\`
   - 카테고리: ${note.frontMatter.category || '(없음)'}
   - 태그: ${note.frontMatter.tags.join(', ') || '(없음)'}
   - 생성: ${note.frontMatter.created}
   - 수정: ${note.frontMatter.updated}`;
      });

      const responseText = `## 고아 노트 검색 결과

**${totalCount}개의 고아 노트** 중 ${paginatedNotes.length}개 표시${category ? `\n카테고리 필터: ${category}` : ''}
정렬: ${sortBy} (${sortOrder})

---

${notesList.join('\n\n')}${totalCount > limit ? `\n\n⋯ 더 많은 결과가 있습니다. limit를 늘려서 확인하세요.` : ''}

---

💡 **팁**: 고아 노트는 다른 노트와 연결하거나, 더 이상 필요 없다면 아카이브하는 것을 고려하세요.`;

      context.logger.info(`[tool:find_orphan_notes] 고아 노트 검색 완료`, {
        totalCount,
        returnedCount: paginatedNotes.length,
      });

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            totalCount,
            returnedCount: paginatedNotes.length,
            category: category ?? null,
            sortBy,
            sortOrder,
            orphanNotes: paginatedNotes.map((note: any) => ({
              uid: note.frontMatter.id,
              title: note.frontMatter.title,
              category: note.frontMatter.category,
              tags: note.frontMatter.tags,
              created: note.frontMatter.created,
              updated: note.frontMatter.updated,
            })),
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(`[tool:find_orphan_notes] 고아 노트 검색 실패`, {
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `고아 노트 검색 실패: ${errorMessage}`,
        { category }
      );
    }
  },
};

/**
 * Tool: find_stale_notes
 */
const findStaleNotesDefinition: ToolDefinition<
  typeof FindStaleNotesInputSchema
> = {
  name: 'find_stale_notes',
  description:
    '지정된 기간 동안 업데이트되지 않은 오래된 노트를 찾습니다.',
  schema: FindStaleNotesInputSchema,
  async handler(
    input: FindStaleNotesInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const {
      staleDays,
      category,
      excludeArchives = true,
      limit = 100,
      sortBy = 'updated',
      sortOrder = 'asc',
    } = input;

    try {
      context.logger.debug(`[tool:find_stale_notes] 오래된 노트 검색 시작`, {
        staleDays,
      });

      // 기준 날짜 계산
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - staleDays);
      const cutoffDateStr = cutoffDate.toISOString();

      // 모든 노트 로드
      const allNotes = await loadAllNotes(context.vaultPath, {
        skipInvalid: true,
        concurrency: 20,
      });

      // 오래된 노트 필터링
      let staleNotes = allNotes.filter(note => {
        const updatedDate = note.frontMatter.updated;
        return updatedDate < cutoffDateStr;
      });

      // Archives 제외
      if (excludeArchives) {
        staleNotes = staleNotes.filter(
          note => note.frontMatter.category !== 'Archives'
        );
      }

      // 카테고리 필터 적용
      if (category) {
        staleNotes = staleNotes.filter(
          note => note.frontMatter.category === category
        );
      }

      // 정렬
      staleNotes.sort((a: any, b: any) => {
        let aValue: string;
        let bValue: string;

        switch (sortBy) {
          case 'created':
            aValue = a.frontMatter.created;
            bValue = b.frontMatter.created;
            break;
          case 'updated':
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
            break;
          case 'title':
            aValue = a.frontMatter.title.toLowerCase();
            bValue = b.frontMatter.title.toLowerCase();
            break;
          default:
            aValue = a.frontMatter.updated;
            bValue = b.frontMatter.updated;
        }

        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      const totalCount = staleNotes.length;
      const paginatedNotes = staleNotes.slice(0, limit);

      // 결과가 없는 경우
      if (paginatedNotes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `## 오래된 노트 검색 결과

${staleDays}일 이상 업데이트되지 않은 노트가 없습니다.${category ? `\n\n카테고리 필터: ${category}` : ''}${excludeArchives ? '\n\nArchives 제외됨' : ''}

모든 노트가 최신 상태입니다! ✅`,
            },
          ],
          _meta: {
            metadata: {
              totalCount: 0,
              returnedCount: 0,
              staleDays,
              category: category ?? null,
              excludeArchives,
            },
          },
        };
      }

      // 일수 계산 헬퍼
      const getDaysAgo = (dateStr: string): number => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      // 결과 포맷팅
      const notesList = paginatedNotes.map((note: any, index: number) => {
        const daysAgo = getDaysAgo(note.frontMatter.updated);
        return `${index + 1}. **${note.frontMatter.title}** (${daysAgo}일 전)
   - ID: \`${note.frontMatter.id}\`
   - 카테고리: ${note.frontMatter.category || '(없음)'}
   - 태그: ${note.frontMatter.tags.join(', ') || '(없음)'}
   - 마지막 수정: ${note.frontMatter.updated}`;
      });

      const responseText = `## 오래된 노트 검색 결과

**${totalCount}개의 오래된 노트** (${staleDays}일 이상 미업데이트) 중 ${paginatedNotes.length}개 표시${category ? `\n카테고리 필터: ${category}` : ''}${excludeArchives ? '\nArchives 제외됨' : ''}
정렬: ${sortBy} (${sortOrder})

---

${notesList.join('\n\n')}${totalCount > limit ? `\n\n⋯ 더 많은 결과가 있습니다. limit를 늘려서 확인하세요.` : ''}

---

💡 **팁**: 오래된 노트는 검토 후 업데이트하거나, 더 이상 필요 없다면 아카이브하는 것을 고려하세요.`;

      context.logger.info(`[tool:find_stale_notes] 오래된 노트 검색 완료`, {
        totalCount,
        returnedCount: paginatedNotes.length,
        staleDays,
      });

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            totalCount,
            returnedCount: paginatedNotes.length,
            staleDays,
            category: category ?? null,
            excludeArchives,
            sortBy,
            sortOrder,
            staleNotes: paginatedNotes.map((note: any) => ({
              uid: note.frontMatter.id,
              title: note.frontMatter.title,
              category: note.frontMatter.category,
              tags: note.frontMatter.tags,
              updated: note.frontMatter.updated,
              daysAgo: getDaysAgo(note.frontMatter.updated),
            })),
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(`[tool:find_stale_notes] 오래된 노트 검색 실패`, {
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `오래된 노트 검색 실패: ${errorMessage}`,
        { staleDays, category }
      );
    }
  },
};

/**
 * Tool: get_organization_health
 */
const getOrganizationHealthDefinition: ToolDefinition<
  typeof GetOrganizationHealthInputSchema
> = {
  name: 'get_organization_health',
  description:
    '볼트의 조직화 건강 상태를 분석합니다. 고아 노트 비율, 카테고리 균형, 오래된 노트 등을 평가합니다.',
  schema: GetOrganizationHealthInputSchema,
  async handler(
    input: GetOrganizationHealthInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { includeDetails = true, includeRecommendations = true } = input;

    try {
      context.logger.debug(`[tool:get_organization_health] 건강 상태 분석 시작`);

      // 모든 노트 로드
      const allNotes = await loadAllNotes(context.vaultPath, {
        skipInvalid: true,
        concurrency: 20,
      });

      const totalNotes = allNotes.length;

      if (totalNotes === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `## 볼트 조직 건강 상태

볼트가 비어 있습니다. 노트를 생성하여 시작하세요!`,
            },
          ],
          _meta: {
            metadata: {
              totalNotes: 0,
              healthScore: 100,
            },
          },
        };
      }

      // 링크 분석
      const linkedFrom = new Set<string>();
      const linkedTo = new Set<string>();

      for (const note of allNotes) {
        const uid = note.frontMatter.id;
        const links = note.frontMatter.links || [];

        if (links.length > 0) {
          linkedFrom.add(uid);
          for (const link of links) {
            linkedTo.add(link);
          }
        }
      }

      // 고아 노트 계산
      const orphanNotes = allNotes.filter(note => {
        const uid = note.frontMatter.id;
        return !linkedFrom.has(uid) && !linkedTo.has(uid);
      });
      const orphanCount = orphanNotes.length;
      const orphanRatio = totalNotes > 0 ? orphanCount / totalNotes : 0;

      // 오래된 노트 계산 (30일 이상)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDateStr = thirtyDaysAgo.toISOString();

      const staleNotes = allNotes.filter(
        note =>
          note.frontMatter.updated < cutoffDateStr &&
          note.frontMatter.category !== 'Archives'
      );
      const staleCount = staleNotes.length;
      const staleRatio = totalNotes > 0 ? staleCount / totalNotes : 0;

      // 카테고리 분포
      const categoryStats: Record<string, number> = {};
      for (const note of allNotes) {
        const category = note.frontMatter.category || 'Uncategorized';
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      }

      // 카테고리 균형 점수 (엔트로피 기반)
      const categoryCount = Object.keys(categoryStats).length;
      let categoryBalanceScore = 100;
      if (categoryCount > 1) {
        const counts = Object.values(categoryStats);
        const entropy = counts.reduce((sum, count) => {
          const p = count / totalNotes;
          return sum - (p > 0 ? p * Math.log2(p) : 0);
        }, 0);
        const maxEntropy = Math.log2(categoryCount);
        categoryBalanceScore = Math.round((entropy / maxEntropy) * 100);
      }

      // 건강 점수 계산 (0-100)
      const orphanPenalty = Math.min(orphanRatio * 100, 40); // 최대 40점 감점
      const stalePenalty = Math.min(staleRatio * 50, 30); // 최대 30점 감점
      const balanceBonus = Math.max(0, (categoryBalanceScore - 50) / 2); // 균형 보너스

      let healthScore = Math.round(100 - orphanPenalty - stalePenalty + balanceBonus);
      healthScore = Math.max(0, Math.min(100, healthScore));

      // 건강 등급
      let healthGrade: string;
      if (healthScore >= 90) healthGrade = 'A (우수)';
      else if (healthScore >= 75) healthGrade = 'B (양호)';
      else if (healthScore >= 60) healthGrade = 'C (보통)';
      else if (healthScore >= 40) healthGrade = 'D (개선 필요)';
      else healthGrade = 'F (심각)';

      // 권장사항 생성
      const recommendations: string[] = [];
      if (includeRecommendations) {
        if (orphanRatio > 0.3) {
          recommendations.push(
            `🔗 고아 노트가 ${orphanCount}개 (${Math.round(orphanRatio * 100)}%) 있습니다. 다른 노트와 연결하거나 아카이브하세요.`
          );
        } else if (orphanRatio > 0.1) {
          recommendations.push(
            `📝 고아 노트 ${orphanCount}개를 검토하고 연결하는 것을 고려하세요.`
          );
        }

        if (staleRatio > 0.3) {
          recommendations.push(
            `⏰ 30일 이상 미업데이트 노트가 ${staleCount}개 (${Math.round(staleRatio * 100)}%) 있습니다. 검토가 필요합니다.`
          );
        } else if (staleRatio > 0.15) {
          recommendations.push(
            `📅 오래된 노트 ${staleCount}개를 검토하세요.`
          );
        }

        if (categoryBalanceScore < 50) {
          recommendations.push(
            `📂 카테고리 분포가 불균형합니다. PARA 원칙에 따라 노트를 재분류하세요.`
          );
        }

        if (recommendations.length === 0) {
          recommendations.push(`✅ 볼트가 잘 정리되어 있습니다! 계속 유지하세요.`);
        }
      }

      // 응답 구성
      let responseText = `## 볼트 조직 건강 상태

### 건강 점수: ${healthScore}/100 (${healthGrade})

**기본 통계**:
- 총 노트: ${totalNotes}개
- 고아 노트: ${orphanCount}개 (${Math.round(orphanRatio * 100)}%)
- 오래된 노트 (30일+): ${staleCount}개 (${Math.round(staleRatio * 100)}%)
- 카테고리 균형: ${categoryBalanceScore}/100`;

      if (includeDetails) {
        responseText += `

### 카테고리 분포
${Object.entries(categoryStats)
  .sort(([, a], [, b]) => b - a)
  .map(([cat, count]) => `- ${cat}: ${count}개 (${Math.round((count / totalNotes) * 100)}%)`)
  .join('\n')}`;
      }

      if (includeRecommendations && recommendations.length > 0) {
        responseText += `

### 권장사항
${recommendations.map(r => `- ${r}`).join('\n')}`;
      }

      context.logger.info(`[tool:get_organization_health] 건강 상태 분석 완료`, {
        healthScore,
        totalNotes,
        orphanCount,
        staleCount,
      });

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            healthScore,
            healthGrade,
            totalNotes,
            orphanCount,
            orphanRatio: Math.round(orphanRatio * 100),
            staleCount,
            staleRatio: Math.round(staleRatio * 100),
            categoryBalanceScore,
            categoryStats,
            recommendations,
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(
        `[tool:get_organization_health] 건강 상태 분석 실패`,
        { error: errorMessage }
      );

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `건강 상태 분석 실패: ${errorMessage}`
      );
    }
  },
};

/**
 * Tool: archive_notes
 */
const archiveNotesDefinition: ToolDefinition<typeof ArchiveNotesInputSchema> = {
  name: 'archive_notes',
  description:
    '여러 노트를 한 번에 Archives 카테고리로 이동합니다. dryRun 모드로 미리보기할 수 있습니다.',
  schema: ArchiveNotesInputSchema,
  async handler(
    input: ArchiveNotesInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uids, dryRun = false, reason } = input;
    // Note: confirm is validated by Zod schema refinement

    try {
      context.logger.debug(`[tool:archive_notes] 아카이브 시작`, {
        count: uids.length,
        dryRun,
      });

      // 노트 찾기 및 검증
      const results: Array<{
        uid: string;
        title: string;
        previousCategory: string;
        status: 'success' | 'skipped' | 'not_found';
        message: string;
      }> = [];

      const notesToArchive: Array<{ note: any; uid: string }> = [];

      for (const uid of uids) {
        const note = await findNoteByUid(uid as any, context.vaultPath);

        if (!note) {
          results.push({
            uid,
            title: '(찾을 수 없음)',
            previousCategory: '',
            status: 'not_found',
            message: '노트를 찾을 수 없습니다',
          });
          continue;
        }

        if (note.frontMatter.category === 'Archives') {
          results.push({
            uid,
            title: note.frontMatter.title,
            previousCategory: 'Archives',
            status: 'skipped',
            message: '이미 Archives 카테고리입니다',
          });
          continue;
        }

        notesToArchive.push({ note, uid });
        results.push({
          uid,
          title: note.frontMatter.title,
          previousCategory: note.frontMatter.category || '(없음)',
          status: 'success',
          message: dryRun ? '아카이브 예정' : '아카이브 완료',
        });
      }

      // dryRun이 아닐 경우 실제 아카이브 수행
      if (!dryRun && notesToArchive.length > 0) {
        for (const { note, uid } of notesToArchive) {
          const updatedFrontMatter = updateFrontMatter(note.frontMatter, {
            category: 'Archives' as any,
          });

          const updatedNote = {
            ...note,
            frontMatter: updatedFrontMatter,
          };

          await saveNote(updatedNote);

          // 검색 인덱스 업데이트
          try {
            const searchEngine = getSearchEngine(context);
            searchEngine.indexNote(updatedNote);
          } catch (indexError) {
            const recoveryQueue = getRecoveryQueue(context);
            recoveryQueue.enqueue({
              operation: 'update',
              noteUid: uid,
              noteFilePath: updatedNote.filePath,
            });
          }
        }
      }

      // 결과 집계
      const successCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const notFoundCount = results.filter(r => r.status === 'not_found').length;

      // 응답 구성
      let responseText = `## 노트 아카이브 ${dryRun ? '(미리보기)' : '완료'}

**요약**:
- 총 요청: ${uids.length}개
- ${dryRun ? '아카이브 예정' : '아카이브 완료'}: ${successCount}개
- 건너뜀 (이미 Archives): ${skippedCount}개
- 찾을 수 없음: ${notFoundCount}개${reason ? `\n- 이유: ${reason}` : ''}

---

`;

      // 결과 목록
      results.forEach((result, index) => {
        const statusIcon =
          result.status === 'success'
            ? '✅'
            : result.status === 'skipped'
              ? '⏭️'
              : '❌';
        responseText += `${index + 1}. ${statusIcon} **${result.title}**
   - UID: \`${result.uid}\`
   - 이전 카테고리: ${result.previousCategory}
   - 상태: ${result.message}

`;
      });

      if (dryRun) {
        responseText += `
---

💡 실제로 아카이브하려면 \`dryRun: false\`와 \`confirm: true\`를 설정하세요.`;
      }

      context.logger.info(`[tool:archive_notes] 아카이브 ${dryRun ? '미리보기' : '완료'}`, {
        total: uids.length,
        success: successCount,
        skipped: skippedCount,
        notFound: notFoundCount,
      });

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            dryRun,
            total: uids.length,
            success: successCount,
            skipped: skippedCount,
            notFound: notFoundCount,
            reason: reason ?? null,
            results,
          },
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(`[tool:archive_notes] 아카이브 실패`, {
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `노트 아카이브 실패: ${errorMessage}`,
        { uids }
      );
    }
  },
};

/**
 * Tool: suggest_links
 */
const suggestLinksDefinition: ToolDefinition<typeof SuggestLinksInputSchema> = {
  name: 'suggest_links',
  description:
    '특정 노트에 대한 잠재적 링크를 제안합니다. 키워드, 태그, 카테고리 유사성을 기반으로 합니다.',
  schema: SuggestLinksInputSchema,
  async handler(
    input: SuggestLinksInput,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { uid, limit = 10, minScore = 0.3, excludeExisting = true } = input;

    try {
      context.logger.debug(`[tool:suggest_links] 링크 제안 시작`, { uid });

      // 대상 노트 찾기
      const targetNote = await findNoteByUid(uid as any, context.vaultPath);
      if (!targetNote) {
        throw new MemoryMcpError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `UID에 해당하는 노트를 찾을 수 없습니다: ${uid}`,
          { uid }
        );
      }

      // 모든 노트 로드
      const allNotes = await loadAllNotes(context.vaultPath, {
        skipInvalid: true,
        concurrency: 20,
      });

      // 기존 링크 집합
      const existingLinks = new Set(targetNote.frontMatter.links || []);

      // 점수 계산을 위한 헬퍼 함수
      const calculateScore = (note: any): number => {
        if (note.frontMatter.id === uid) return 0;
        if (excludeExisting && existingLinks.has(note.frontMatter.id)) return 0;

        let score = 0;

        // 1. 태그 유사성 (최대 0.4)
        const targetTags = new Set(targetNote.frontMatter.tags || []);
        const noteTags = note.frontMatter.tags || [];
        if (targetTags.size > 0 && noteTags.length > 0) {
          const commonTags = noteTags.filter((t: string) => targetTags.has(t)).length;
          const tagScore = commonTags / Math.max(targetTags.size, noteTags.length);
          score += tagScore * 0.4;
        }

        // 2. 카테고리 일치 (0.2)
        if (
          targetNote.frontMatter.category &&
          note.frontMatter.category === targetNote.frontMatter.category
        ) {
          score += 0.2;
        }

        // 3. 프로젝트 일치 (0.2)
        if (
          targetNote.frontMatter.project &&
          note.frontMatter.project === targetNote.frontMatter.project
        ) {
          score += 0.2;
        }

        // 4. 제목/내용 키워드 매칭 (최대 0.2)
        const targetWords = new Set(
          (targetNote.frontMatter.title + ' ' + targetNote.content)
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 3)
        );
        const noteWords = (note.frontMatter.title + ' ' + note.content)
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3);

        if (targetWords.size > 0 && noteWords.length > 0) {
          const commonWords = noteWords.filter((w: string) => targetWords.has(w)).length;
          const wordScore = Math.min(commonWords / 10, 1);
          score += wordScore * 0.2;
        }

        return score;
      };

      // 점수 계산 및 필터링
      const suggestions = allNotes
        .map(note => ({
          uid: note.frontMatter.id,
          title: note.frontMatter.title,
          category: note.frontMatter.category,
          tags: note.frontMatter.tags,
          score: calculateScore(note),
        }))
        .filter(s => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // 결과가 없는 경우
      if (suggestions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `## 링크 제안

**${targetNote.frontMatter.title}**에 대한 링크 제안이 없습니다.

최소 점수: ${minScore}
${excludeExisting ? '기존 링크 제외됨' : ''}

💡 태그를 추가하거나 관련 노트를 더 작성해보세요.`,
            },
          ],
          _meta: {
            metadata: {
              targetUid: uid,
              targetTitle: targetNote.frontMatter.title,
              totalSuggestions: 0,
              minScore,
              excludeExisting,
            },
          },
        };
      }

      // 결과 포맷팅
      const suggestionsList = suggestions.map((s, index) => {
        const commonTags = (s.tags || []).filter((t: string) =>
          (targetNote.frontMatter.tags || []).includes(t)
        );
        return `${index + 1}. **${s.title}** (점수: ${(s.score * 100).toFixed(0)}%)
   - UID: \`${s.uid}\`
   - 카테고리: ${s.category || '(없음)'}
   - 공통 태그: ${commonTags.length > 0 ? commonTags.join(', ') : '(없음)'}`;
      });

      const responseText = `## 링크 제안

**${targetNote.frontMatter.title}**에 대한 ${suggestions.length}개의 링크 제안

최소 점수: ${minScore}
${excludeExisting ? '기존 링크 제외됨' : ''}

---

${suggestionsList.join('\n\n')}

---

💡 제안된 노트를 검토하고 \`update_note\`로 링크를 추가하세요.`;

      context.logger.info(`[tool:suggest_links] 링크 제안 완료`, {
        targetUid: uid,
        suggestions: suggestions.length,
      });

      return {
        content: [{ type: 'text', text: responseText }],
        _meta: {
          metadata: {
            targetUid: uid,
            targetTitle: targetNote.frontMatter.title,
            totalSuggestions: suggestions.length,
            minScore,
            excludeExisting,
            suggestions,
          },
        },
      };
    } catch (error) {
      if (error instanceof MemoryMcpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.logger.error(`[tool:suggest_links] 링크 제안 실패`, {
        error: errorMessage,
      });

      throw new MemoryMcpError(
        ErrorCode.STORAGE_ERROR,
        `링크 제안 실패: ${errorMessage}`,
        { uid }
      );
    }
  },
};

/**
 * Tool Map (확장: 14 tools)
 */
type RegisteredTool =
  | typeof searchMemoryDefinition
  | typeof createNoteDefinition
  | typeof readNoteDefinition
  | typeof listNotesDefinition
  | typeof updateNoteDefinition
  | typeof deleteNoteDefinition
  | typeof getVaultStatsDefinition
  | typeof getBacklinksDefinition
  | typeof getMetricsDefinition
  | typeof findOrphanNotesDefinition
  | typeof findStaleNotesDefinition
  | typeof getOrganizationHealthDefinition
  | typeof archiveNotesDefinition
  | typeof suggestLinksDefinition;

const toolMap: Record<ToolName, RegisteredTool> = {
  search_memory: searchMemoryDefinition,
  create_note: createNoteDefinition,
  read_note: readNoteDefinition,
  list_notes: listNotesDefinition,
  update_note: updateNoteDefinition,
  delete_note: deleteNoteDefinition,
  get_vault_stats: getVaultStatsDefinition,
  get_backlinks: getBacklinksDefinition,
  get_metrics: getMetricsDefinition,
  // Organization tools
  find_orphan_notes: findOrphanNotesDefinition,
  find_stale_notes: findStaleNotesDefinition,
  get_organization_health: getOrganizationHealthDefinition,
  archive_notes: archiveNotesDefinition,
  suggest_links: suggestLinksDefinition,
};

const toolDefinitions: RegisteredTool[] = [
  searchMemoryDefinition,
  createNoteDefinition,
  readNoteDefinition,
  listNotesDefinition,
  updateNoteDefinition,
  deleteNoteDefinition,
  getVaultStatsDefinition,
  getBacklinksDefinition,
  getMetricsDefinition,
  // Organization tools
  findOrphanNotesDefinition,
  findStaleNotesDefinition,
  getOrganizationHealthDefinition,
  archiveNotesDefinition,
  suggestLinksDefinition,
];

function toJsonSchema(definition: RegisteredTool): JsonSchema {
  const schema = zodToJsonSchema(definition.schema, {
    name: definition.name,
    target: 'jsonSchema7',
    $refStrategy: 'none', // MCP에서는 $ref 없이 인라인 스키마가 필요
  });

  // MCP 프로토콜은 최상위 type이 "object"이어야 함
  if (schema && typeof schema === 'object' && !('type' in schema)) {
    return { ...schema, type: 'object' } as JsonSchema;
  }

  return schema;
}

/**
 * List all available tools
 */
export function listTools(): Array<{
  name: ToolName;
  description: string;
  inputSchema: JsonSchema;
}> {
  return toolDefinitions.map(definition => ({
    name: definition.name as ToolName,
    description: definition.description,
    inputSchema: toJsonSchema(definition),
  }));
}

/**
 * Claude Desktop 호환성을 위한 입력 전처리
 * Claude Desktop이 배열을 문자열로 직렬화하여 전송하는 경우를 처리
 */
function preprocessToolInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  const obj = input as Record<string, unknown>;
  const processed = { ...obj };

  // tags 필드가 문자열이면 JSON 파싱 시도
  if (typeof processed.tags === 'string') {
    try {
      const parsed = JSON.parse(processed.tags);
      if (Array.isArray(parsed)) {
        processed.tags = parsed;
      }
    } catch {
      // 파싱 실패 시 원래 값 유지 (스키마 검증에서 에러 처리됨)
    }
  }

  // links 필드가 문자열이면 JSON 파싱 시도
  if (typeof processed.links === 'string') {
    try {
      const parsed = JSON.parse(processed.links);
      if (Array.isArray(parsed)) {
        processed.links = parsed;
      }
    } catch {
      // 파싱 실패 시 원래 값 유지
    }
  }

  return processed;
}

/**
 * Execute a tool
 */
export async function executeTool(
  name: ToolName,
  rawInput: unknown,
  context: ToolExecutionContext,
  overrides?: Partial<ToolExecutionContext['policy']>
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

  // Claude Desktop 호환성: 문자열로 된 배열을 파싱
  const preprocessedInput = preprocessToolInput(rawInput);

  const parsedInput = await definition.schema
    .parseAsync(preprocessedInput)
    .catch((error: unknown) => {
      throw new MemoryMcpError(
        ErrorCode.SCHEMA_VALIDATION_ERROR,
        '툴 입력이 유효하지 않습니다.',
        {
          validationErrors: error instanceof Error ? error.message : error,
          tool: definition.name,
        }
      );
    });

  const policy = {
    ...DEFAULT_EXECUTION_POLICY,
    ...context.policy,
    ...overrides,
  };

  // 메트릭 수집 시작
  const metrics = getMetricsCollector(context);
  const startTime = metrics.startToolExecution(definition.name);

  context.logger.debug(
    `[tool:${definition.name}] 실행 시작`,
    createLogEntry('debug', 'tool.start', {
      name: definition.name,
      inputPreview: maskSensitiveInfo(JSON.stringify(parsedInput)).slice(
        0,
        200
      ),
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
            createLogEntry('warn', 'tool.retry', {
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
      createLogEntry('info', 'tool.success', {
        duration,
        name: definition.name,
      })
    );

    // 메트릭 수집 완료 (성공)
    metrics.endToolExecution(definition.name, startTime, true);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    context.logger.error(
      `[tool:${definition.name}] 실행 실패 (${duration}ms)`,
      createLogEntry('error', 'tool.failure', {
        duration,
        name: definition.name,
        error: error instanceof Error ? error.message : String(error),
      })
    );

    // 메트릭 수집 완료 (실패)
    const errorCode = error instanceof MemoryMcpError ? error.code : 'UNKNOWN';
    metrics.endToolExecution(definition.name, startTime, false, errorCode);

    throw error;
  }
}
