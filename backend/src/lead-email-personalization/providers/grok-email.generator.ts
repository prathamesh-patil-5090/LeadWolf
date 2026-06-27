import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutreachEmailContext,
  ProviderGenerationResult,
} from '../interfaces/email-generation.interface';
import { buildOutreachEmailPrompt } from '../prompts/outreach-email.prompt';
import { EMAIL_PROVIDERS } from '../constants';
import {
  parseDraftFromContent,
  requestChatCompletionDraft,
} from '../../shared/llm/chat-completion.client';
import { resolveGroqApiKey, resolveXaiApiKey } from '../../shared/llm/llm-credentials.util';

@Injectable()
export class GrokEmailGenerator {
  private readonly logger = new Logger(GrokEmailGenerator.name);

  constructor(private readonly configService: ConfigService) {}

  async generate(context: OutreachEmailContext): Promise<ProviderGenerationResult> {
    const startedAt = Date.now();
    const model = this.configService.get<string>('XAI_MODEL', 'grok-3-mini');
    const apiKey = resolveXaiApiKey(this.configService.get<string>('XAI_API_KEY'));

    if (!apiKey) {
      const misplacedGroq = resolveGroqApiKey(
        this.configService.get<string>('GROQ_API_KEY'),
        this.configService.get<string>('XAI_API_KEY'),
      );

      return {
        provider: EMAIL_PROVIDERS.GROK,
        model,
        latencyMs: Date.now() - startedAt,
        error: misplacedGroq
          ? 'XAI_API_KEY contains a Groq key (gsk_). Use GROQ_API_KEY instead, or set a real xai- key from console.x.ai'
          : 'XAI_API_KEY not set (must start with xai-)',
      };
    }

    try {
      const { content, raw } = await requestChatCompletionDraft({
        baseUrl: 'https://api.x.ai/v1',
        apiKey,
        model,
        messages: [
          {
            role: 'system',
            content:
              'You write short, human, casual cold emails to developers. Use simple everyday English — no heavy or formal words. Return valid JSON with subject and body fields only. The body must end with the provided signature block.',
          },
          { role: 'user', content: buildOutreachEmailPrompt(context) },
        ],
      });

      const { draft, parseHint } = parseDraftFromContent(content, raw);
      if (!draft && parseHint) {
        this.logger.warn(`Grok parse failed: ${parseHint}`);
      }

      return {
        provider: EMAIL_PROVIDERS.GROK,
        model,
        draft: draft ?? undefined,
        latencyMs: Date.now() - startedAt,
        error: draft ? undefined : parseHint ?? 'Empty Grok response',
      };
    } catch (error) {
      this.logger.warn(
        `Grok email generation failed: ${error instanceof Error ? error.message : error}`,
      );
      return {
        provider: EMAIL_PROVIDERS.GROK,
        model,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Grok request failed',
      };
    }
  }
}
