import {
    ErrorCode,
    MemoryMcpError,
    logger,
    ORGANIZE_NOTES_DEFAULTS,
} from "@inchankang/zettel-memory-common";
import {
    loadAllNotes,
    saveNote,
} from "@inchankang/zettel-memory-storage-md";
import { z } from "zod";
import { OllamaClient } from "../ollama-client.js";
import type { ToolExecutionContext, ToolResult } from "./types.js";
import type { OrganizeNotesInput } from "./schemas.js";

/**
 * Organization actions that can be performed on notes.
 * Uses Discriminated Union pattern for type safety.
 */
const OrganizationActionSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("tag"),
        targetUid: z.string().min(1),
        value: z.string().min(1),
        reason: z.string(),
    }),
    z.object({
        type: z.literal("archive"),
        targetUid: z.string().min(1),
        reason: z.string(),
    }),
]);

const OllamaResponseSchema = z.object({
    actions: z.array(OrganizationActionSchema),
});

type OllamaResponse = z.infer<typeof OllamaResponseSchema>;

export async function organizeNotes(
    input: OrganizeNotesInput,
    context: ToolExecutionContext
): Promise<ToolResult> {
    const { dryRun = true, limit = ORGANIZE_NOTES_DEFAULTS.DEFAULT_LIMIT } = input;
    const { vaultPath } = context;

    if (!vaultPath) {
        throw new MemoryMcpError(
            ErrorCode.INTERNAL_ERROR,
            "Vault path is not configured"
        );
    }

    try {
        // 1. Load recent notes
        const allNotes = await loadAllNotes(vaultPath, { skipInvalid: true });
        // Sort by updated desc and take top N
        const recentNotes = allNotes
            .sort((a, b) => {
                const timeA = a.frontMatter.updated
                    ? new Date(a.frontMatter.updated).getTime()
                    : 0;
                const timeB = b.frontMatter.updated
                    ? new Date(b.frontMatter.updated).getTime()
                    : 0;
                return timeB - timeA;
            })
            .slice(0, limit);

        if (recentNotes.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No notes found to organize.",
                    },
                ],
            };
        }

        // 2. Prepare prompt for Ollama
        const notesSummary = recentNotes
            .map(
                (note) =>
                    `ID: ${note.frontMatter.id}\nTitle: ${note.frontMatter.title}\nTags: ${note.frontMatter.tags.join(
                        ", "
                    )}\nContent Preview: ${note.content.slice(0, ORGANIZE_NOTES_DEFAULTS.CONTENT_PREVIEW_LENGTH)}...`
            )
            .join("\n---\n");

        const prompt = `
You are a helpful assistant that organizes personal notes.
Analyze the following notes and suggest actions to improve organization.

Possible actions:
1. "tag": Add a relevant tag to a note if it's missing or would improve categorization.
2. "archive": Archive a note if it seems finished, completed, or no longer relevant.

Return ONLY a valid JSON object with a list of actions.
Format:
{
  "actions": [
    { "type": "tag", "targetUid": "note_id", "value": "new_tag", "reason": "explanation" },
    { "type": "archive", "targetUid": "note_id", "reason": "explanation" }
  ]
}

Notes to analyze:
${notesSummary}
`;

        // 3. Call Ollama
        const ollama = new OllamaClient();
        if (!(await ollama.isAvailable())) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Ollama is not available. Please make sure it is running.",
                    },
                ],
                isError: true,
            };
        }

        const response = await ollama.chat(
            [{ role: "user", content: prompt }],
            { format: "json" }
        );

        let result: OllamaResponse;
        try {
            const parsed = JSON.parse(response.message.content);
            result = OllamaResponseSchema.parse(parsed);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error("Failed to parse or validate Ollama response", {
                error: errorMessage,
                rawContent: response.message.content,
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to parse Ollama response: ${errorMessage}\n\nRaw response:\n${response.message.content.slice(0, 500)}${response.message.content.length > 500 ? "..." : ""}`,
                    },
                ],
                isError: true,
            };
        }

        // 4. Apply actions (or just report if dryRun)
        const executedActions: string[] = [];

        for (const action of result.actions) {
            const note = recentNotes.find((n) => n.frontMatter.id === action.targetUid);
            if (!note) continue;

            const actionDesc =
                action.type === "tag"
                    ? `TAG ${action.targetUid} -> ${action.value} (${action.reason})`
                    : `ARCHIVE ${action.targetUid} (${action.reason})`;

            if (dryRun) {
                executedActions.push(`[PROPOSED] ${actionDesc}`);
            } else {
                try {
                    let updated = false;
                    const newFrontMatter = { ...note.frontMatter };

                    if (action.type === "tag") {
                        if (!newFrontMatter.tags.includes(action.value)) {
                            newFrontMatter.tags = [...newFrontMatter.tags, action.value];
                            updated = true;
                        }
                    } else if (action.type === "archive") {
                        // Add "archived" tag and optionally change category to Archives
                        if (!newFrontMatter.tags.includes("archived")) {
                            newFrontMatter.tags = [...newFrontMatter.tags, "archived"];
                            updated = true;
                        }
                        if (newFrontMatter.category !== "Archives") {
                            newFrontMatter.category = "Archives";
                            updated = true;
                        }
                    }

                    if (updated) {
                        const updatedNote = {
                            ...note,
                            frontMatter: newFrontMatter,
                        };
                        await saveNote(updatedNote);
                        executedActions.push(`[EXECUTED] ${actionDesc}`);
                    } else {
                        executedActions.push(`[NO-OP] ${actionDesc}`);
                    }
                } catch (err) {
                    executedActions.push(`[FAILED] ${actionDesc} - ${err}`);
                }
            }
        }

        return {
            content: [
                {
                    type: "text",
                    text: `Organization complete (${dryRun ? "Dry Run" : "Live"}).\n\n${executedActions.join(
                        "\n"
                    )}`,
                },
            ],
        };
    } catch (error) {
        logger.error("Organize notes error:", error);
        throw new MemoryMcpError(
            ErrorCode.INTERNAL_ERROR,
            `Failed to organize notes: ${error}`
        );
    }
}
