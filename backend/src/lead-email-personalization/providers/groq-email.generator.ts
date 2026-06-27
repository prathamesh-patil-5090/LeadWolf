import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutreachEmailContext,
  ProviderGenerationResult,
} from '../interfaces/email-generation.interface';
import { EMAIL_GENERATION_SYSTEM_PROMPT } from '../prompts/crag-product.context';
import { buildOutreachEmailPrompt } from '../prompts/outreach-email.prompt';
import { EMAIL_PROVIDERS } from '../constants';
import {
  parseDraftFromContent,
  requestChatCompletionDraft,
} from '../../shared/llm/chat-completion.client';
import { resolveGroqApiKey } from '../../shared/llm/llm-credentials.util';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service';

@Injectable()
export class GroqEmailGenerator {
  private readonly logger = new Logger(GroqEmailGenerator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async generate(context: OutreachEmailContext): Promise<ProviderGenerationResult> {
    const startedAt = Date.now();
    const model = this.configService.get<string>(
      'GROQ_MODEL',
      'llama-3.3-70b-versatile',
    );
    const apiKey = resolveGroqApiKey(
      this.configService.get<string>('GROQ_API_KEY'),
      this.configService.get<string>('XAI_API_KEY'),
    );

    if (!apiKey) {
      return {
        provider: EMAIL_PROVIDERS.GROQ,
        model,
        latencyMs: Date.now() - startedAt,
        error: 'GROQ_API_KEY not set',
      };
    }

    try {
      await this.rateLimitService.acquireGroq('email-generation');
      const { content, raw } = await requestChatCompletionDraft({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey,
        model,
        messages: [
          {
            role: 'system',
            content: EMAIL_GENERATION_SYSTEM_PROMPT,
          },
          { role: 'user', content: buildOutreachEmailPrompt(context) },
        ],
      });

      const { draft, parseHint } = parseDraftFromContent(content, raw);
      if (!draft && parseHint) {
        this.logger.warn(`Groq parse failed: ${parseHint}`);
      }

      return {
        provider: EMAIL_PROVIDERS.GROQ,
        model,
        draft: draft ?? undefined,
        latencyMs: Date.now() - startedAt,
        error: draft ? undefined : parseHint ?? 'Empty Groq response',
      };
    } catch (error) {
      this.logger.warn(
        `Groq email generation failed: ${error instanceof Error ? error.message : error}`,
      );
      return {
        provider: EMAIL_PROVIDERS.GROQ,
        model,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Groq request failed',
      };
    }
  }
}
