import { ParaCategorySchema } from '@inchankang/zettel-memory-common';
import { z } from 'zod';

export const SearchMemoryInputSchema = z
  .object({
    query: z
      .string({
        required_error: '검색어는 필수 입력값입니다.',
        invalid_type_error: '검색어는 문자열이어야 합니다.',
      })
      .min(1, '검색어는 최소 1자 이상이어야 합니다.'),
    category: ParaCategorySchema.optional(),
    tags: z
      .array(z.string().min(1, '태그는 최소 1자 이상이어야 합니다.'))
      .default([])
      .optional(),
    limit: z
      .number({ invalid_type_error: 'limit는 숫자여야 합니다.' })
      .int('limit는 정수여야 합니다.')
      .min(1, 'limit는 최소 1 이상이어야 합니다.')
      .max(100, 'limit는 최대 100까지 허용됩니다.')
      .default(10)
      .optional(),
    offset: z
      .number({ invalid_type_error: 'offset은 숫자여야 합니다.' })
      .int('offset은 정수여야 합니다.')
      .min(0, 'offset은 음수가 될 수 없습니다.')
      .default(0)
      .optional(),
  })
  .strict();

export type SearchMemoryInput = z.infer<typeof SearchMemoryInputSchema>;

export const CreateNoteInputSchema = z
  .object({
    title: z
      .string({
        required_error: '제목은 필수 입력값입니다.',
        invalid_type_error: '제목은 문자열이어야 합니다.',
      })
      .min(1, '제목은 최소 1자 이상이어야 합니다.'),
    content: z
      .string({
        required_error: '내용은 필수 입력값입니다.',
        invalid_type_error: '내용은 문자열이어야 합니다.',
      })
      .min(1, '내용은 최소 1자 이상이어야 합니다.'),
    category: ParaCategorySchema.optional(), // v2: Made optional for Zettelkasten notes
    tags: z
      .array(z.string().min(1, '태그는 최소 1자 이상이어야 합니다.'))
      .default([]),
    project: z
      .string({ invalid_type_error: 'project는 문자열이어야 합니다.' })
      .min(1, 'project는 최소 1자 이상이어야 합니다.')
      .optional(),
    links: z
      .array(z.string().min(1, '링크 ID는 최소 1자 이상이어야 합니다.'))
      .default([])
      .optional(),
  })
  .strict();

export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

// read_note - Read a single note by UID
export const ReadNoteInputSchema = z
  .object({
    uid: z
      .string({
        required_error: 'UID는 필수 입력값입니다.',
        invalid_type_error: 'UID는 문자열이어야 합니다.',
      })
      .min(1, 'UID는 최소 1자 이상이어야 합니다.'),
    includeMetadata: z
      .boolean()
      .default(false)
      .optional()
      .describe('메타데이터(파일 크기, 단어 수 등) 포함 여부'),
    includeLinks: z
      .boolean()
      .default(false)
      .optional()
      .describe('링크 분석(백링크, 깨진 링크 등) 포함 여부'),
  })
  .strict();

export type ReadNoteInput = z.infer<typeof ReadNoteInputSchema>;

// update_note - Update existing note
export const UpdateNoteInputSchema = z
  .object({
    uid: z
      .string({
        required_error: 'UID는 필수 입력값입니다.',
      })
      .min(1, 'UID는 최소 1자 이상이어야 합니다.'),
    title: z.string().min(1, '제목은 최소 1자 이상이어야 합니다.').optional(),
    content: z.string().optional(),
    category: ParaCategorySchema.optional(),
    tags: z.array(z.string().min(1)).optional(),
    project: z.string().min(1).optional().nullable(),
    links: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine(
    data => {
      const { uid, ...updateFields } = data;
      return Object.keys(updateFields).length > 0;
    },
    { message: '최소 하나의 업데이트 필드가 필요합니다.' }
  );

export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;

// delete_note - Delete a note
export const DeleteNoteInputSchema = z
  .object({
    uid: z
      .string({
        required_error: 'UID는 필수 입력값입니다.',
      })
      .min(1, 'UID는 최소 1자 이상이어야 합니다.'),
    confirm: z
      .boolean({
        required_error: '삭제 확인은 필수입니다.',
      })
      .refine(val => val === true, {
        message: '삭제를 확인하려면 confirm을 true로 설정해야 합니다.',
      }),
  })
  .strict();

export type DeleteNoteInput = z.infer<typeof DeleteNoteInputSchema>;

// list_notes - List notes with filters
export const ListNotesInputSchema = z
  .object({
    category: ParaCategorySchema.optional(),
    tags: z.array(z.string().min(1)).optional(),
    project: z.string().min(1).optional(),
    limit: z
      .number()
      .int('limit는 정수여야 합니다.')
      .min(1, 'limit는 최소 1 이상이어야 합니다.')
      .max(1000, 'limit는 최대 1000까지 허용됩니다.')
      .default(100)
      .optional(),
    offset: z
      .number()
      .int('offset은 정수여야 합니다.')
      .min(0, 'offset은 음수가 될 수 없습니다.')
      .default(0)
      .optional(),
    sortBy: z
      .enum(['created', 'updated', 'title'])
      .default('updated')
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  })
  .strict();

export type ListNotesInput = z.infer<typeof ListNotesInputSchema>;

// get_vault_stats - Get vault statistics
export const GetVaultStatsInputSchema = z
  .object({
    includeCategories: z
      .boolean()
      .default(true)
      .optional()
      .describe('카테고리별 통계 포함 여부'),
    includeTagStats: z
      .boolean()
      .default(true)
      .optional()
      .describe('태그 통계 포함 여부'),
    includeLinkStats: z
      .boolean()
      .default(true)
      .optional()
      .describe('링크 통계 포함 여부'),
  })
  .strict();

export type GetVaultStatsInput = z.infer<typeof GetVaultStatsInputSchema>;

// get_backlinks - Find notes linking to a specific note
export const GetBacklinksInputSchema = z
  .object({
    uid: z
      .string({
        required_error: 'UID는 필수 입력값입니다.',
      })
      .min(1, 'UID는 최소 1자 이상이어야 합니다.'),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  })
  .strict();

export type GetBacklinksInput = z.infer<typeof GetBacklinksInputSchema>;

// get_metrics - Get system metrics
export const GetMetricsInputSchema = z
  .object({
    format: z
      .enum(['json', 'prometheus'])
      .default('json')
      .optional()
      .describe('출력 형식'),
    reset: z.boolean().default(false).optional().describe('메트릭 초기화 여부'),
  })
  .strict();

export type GetMetricsInput = z.infer<typeof GetMetricsInputSchema>;

// find_orphan_notes - Find notes with no incoming or outgoing links
export const FindOrphanNotesInputSchema = z
  .object({
    limit: z
      .number()
      .int('limit는 정수여야 합니다.')
      .min(1, 'limit는 최소 1 이상이어야 합니다.')
      .max(1000, 'limit는 최대 1000까지 허용됩니다.')
      .default(100)
      .optional()
      .describe('반환할 최대 고아 노트 수'),
    category: ParaCategorySchema.optional().describe(
      '특정 카테고리로 필터링'
    ),
    sortBy: z
      .enum(['created', 'updated', 'title'])
      .default('updated')
      .optional()
      .describe('정렬 기준'),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  })
  .strict();

export type FindOrphanNotesInput = z.infer<typeof FindOrphanNotesInputSchema>;

// find_stale_notes - Find notes not updated for a specified period
export const FindStaleNotesInputSchema = z
  .object({
    staleDays: z
      .number({
        required_error: 'staleDays는 필수 입력값입니다.',
        invalid_type_error: 'staleDays는 숫자여야 합니다.',
      })
      .int('staleDays는 정수여야 합니다.')
      .min(1, 'staleDays는 최소 1 이상이어야 합니다.')
      .max(3650, 'staleDays는 최대 3650(10년)까지 허용됩니다.')
      .describe('이 일수 이상 업데이트되지 않은 노트를 찾습니다'),
    category: ParaCategorySchema.optional().describe(
      '특정 카테고리로 필터링'
    ),
    excludeArchives: z
      .boolean()
      .default(true)
      .optional()
      .describe('Archives 카테고리 제외 여부'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .optional()
      .describe('반환할 최대 노트 수'),
    sortBy: z
      .enum(['created', 'updated', 'title'])
      .default('updated')
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
  })
  .strict();

export type FindStaleNotesInput = z.infer<typeof FindStaleNotesInputSchema>;

// get_organization_health - Get vault organization health metrics
export const GetOrganizationHealthInputSchema = z
  .object({
    includeDetails: z
      .boolean()
      .default(true)
      .optional()
      .describe('상세 분석 포함 여부'),
    includeRecommendations: z
      .boolean()
      .default(true)
      .optional()
      .describe('개선 권장사항 포함 여부'),
  })
  .strict();

export type GetOrganizationHealthInput = z.infer<
  typeof GetOrganizationHealthInputSchema
>;

// archive_notes - Archive multiple notes at once
export const ArchiveNotesInputSchema = z
  .object({
    uids: z
      .array(z.string().min(1, 'UID는 최소 1자 이상이어야 합니다.'))
      .min(1, '최소 하나의 UID가 필요합니다.')
      .max(100, '한 번에 최대 100개까지 아카이브할 수 있습니다.')
      .describe('아카이브할 노트 UID 목록'),
    dryRun: z
      .boolean()
      .default(false)
      .optional()
      .describe('true일 경우 실제 변경 없이 결과만 미리보기'),
    confirm: z
      .boolean()
      .default(false)
      .optional()
      .describe('dryRun이 false일 때 실행 확인 (필수)'),
    reason: z
      .string()
      .max(500, '이유는 최대 500자까지 허용됩니다.')
      .optional()
      .describe('아카이브 이유 (메타데이터에 기록)'),
  })
  .strict()
  .refine(
    data => {
      // dryRun이 아닐 경우 confirm이 true여야 함
      if (!data.dryRun && !data.confirm) {
        return false;
      }
      return true;
    },
    {
      message:
        '실제 아카이브를 수행하려면 confirm=true를 설정하거나 dryRun=true로 미리보기하세요.',
    }
  );

export type ArchiveNotesInput = z.infer<typeof ArchiveNotesInputSchema>;

// suggest_links - Suggest potential links for a note
export const SuggestLinksInputSchema = z
  .object({
    uid: z
      .string({
        required_error: 'UID는 필수 입력값입니다.',
      })
      .min(1, 'UID는 최소 1자 이상이어야 합니다.')
      .describe('링크를 제안받을 노트의 UID'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .optional()
      .describe('반환할 최대 제안 수'),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .optional()
      .describe('최소 관련성 점수 (0-1)'),
    excludeExisting: z
      .boolean()
      .default(true)
      .optional()
      .describe('이미 연결된 노트 제외'),
  })
  .strict();

export type SuggestLinksInput = z.infer<typeof SuggestLinksInputSchema>;

export const ToolNameSchema = z.enum([
  'search_memory',
  'create_note',
  'read_note',
  'update_note',
  'delete_note',
  'list_notes',
  'get_vault_stats',
  'get_backlinks',
  'get_metrics',
  // Organization tools
  'find_orphan_notes',
  'find_stale_notes',
  'get_organization_health',
  'archive_notes',
  'suggest_links',
]);

export type ToolName = z.infer<typeof ToolNameSchema>;
