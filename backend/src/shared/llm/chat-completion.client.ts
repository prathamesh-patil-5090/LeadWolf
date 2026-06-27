import { parseEmailDraftResponse } from '../../lead-email-personalization/prompts/outreach-email.prompt';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  jsonMode?: boolean;
}

export async function requestChatCompletionDraft(
  options: ChatCompletionOptions,
): Promise<{ content: string | null; raw: string }> {
  const body: Record<string, unknown> = {
    model: options.model,
    temperature: options.temperature ?? 0.4,
    messages: options.messages,
  };

  if (options.jsonMode !== false) {
    body.response_format = { type: 'json_object' };
  }

  let response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  });

  let raw = await response.text();

  if (!response.ok && options.jsonMode !== false) {
    response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        ...options.extraHeaders,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature ?? 0.4,
        messages: options.messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
    });
    raw = await response.text();
  }

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${raw.slice(0, 300)}`);
  }

  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? null;

  return { content, raw };
}

export function parseDraftFromContent(content: string | null, raw: string) {
  if (!content) {
    return { draft: null, parseHint: `No message content in response: ${raw.slice(0, 200)}` };
  }

  const draft = parseEmailDraftResponse(content);
  return {
    draft,
    parseHint: draft ? undefined : `Unparseable content: ${content.slice(0, 200)}`,
  };
}
