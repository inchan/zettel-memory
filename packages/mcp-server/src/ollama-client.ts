import { logger, OLLAMA_DEFAULTS } from "@inchankang/zettel-memory-common";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  model: string;
  created_at: string;
  message: Message;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaClient {
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl || OLLAMA_DEFAULTS.BASE_URL;
    this.defaultModel = config.model || OLLAMA_DEFAULTS.MODEL;
  }

  /**
   * Check if Ollama is reachable
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      logger.warn("Ollama is not reachable:", error);
      return false;
    }
  }

  /**
   * Chat with Ollama
   */
  async chat(
    messages: Message[],
    options: { model?: string; format?: "json"; temperature?: number } = {}
  ): Promise<ChatResponse> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    const body = {
      model,
      messages,
      stream: false,
      format: options.format,
      options: {
        temperature: options.temperature,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ChatResponse;
      return data;
    } catch (error) {
      logger.error("Failed to chat with Ollama:", error);
      throw error;
    }
  }
}
