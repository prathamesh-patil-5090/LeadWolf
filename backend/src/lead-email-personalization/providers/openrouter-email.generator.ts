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
import { isInstructModel } from '../../shared/llm/llm-credentials.util';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service';

const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const DEFAULT_FALLBACK_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
];

function supportsJsonResponseFormat(model: string) {
  const normalized = model.toLowerCase();
  return (
    normalized.includes('instruct') ||
    normalized.includes('llama') ||
    normalized.includes('qwen') ||
    normalized.includes('mistral')
  ) && !normalized.includes('nemotron');
}

function timeoutForModel(model: string) {
  if (model === 'openrouter/free') {
    return 35_000;
  }

  if (model.toLowerCase().includes('nemotron')) {
    return 45_000;
  }

  return 60_000;
}

@Injectable()
export class OpenRouterEmailGenerator {
  private readonly logger = new Logger(OpenRouterEmailGenerator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async generate(context: OutreachEmailContext): Promise<ProviderGenerationResult> {
    const startedAt = Date.now();
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      return {
        provider: EMAIL_PROVIDERS.OPENROUTER,
        model: DEFAULT_OPENROUTER_MODEL,
        latencyMs: Date.now() - startedAt,
        error: 'OPENROUTER_API_KEY not set',
      };
    }

    const models = this.resolveModels();
    let lastError = 'No OpenRouter models configured';

    for (const model of models) {
      if (!isInstructModel(model)) {
        this.logger.warn(`Skipping non-instruct OpenRouter model: ${model}`);
        continue;
      }

      try {
        await this.rateLimitService.acquireOpenRouter(`email-generation:${model}`);
        const { content, raw } = await requestChatCompletionDraft({
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey,
          model,
          jsonMode: supportsJsonResponseFormat(model),
          timeoutMs: timeoutForModel(model),
          extraHeaders: {
            'HTTP-Referer': 'https://leadwolf.local',
            'X-Title': 'LeadWolf',
          },
          messages: [
            {
              role: 'system',
              content: EMAIL_GENERATION_SYSTEM_PROMPT,
            },
            { role: 'user', content: buildOutreachEmailPrompt(context) },
          ],
        });

        const { draft, parseHint } = parseDraftFromContent(content, raw);
        if (draft) {
          return {
            provider: EMAIL_PROVIDERS.OPENROUTER,
            model,
            draft,
            latencyMs: Date.now() - startedAt,
          };
        }

        lastError = parseHint ?? `Empty response from ${model}`;
        this.logger.warn(lastError);
      } catch (error) {
        lastError = error instanceof Error ? error.message : `Failed on ${model}`;
        this.logger.warn(`OpenRouter model ${model} failed: ${lastError}`);
      }
    }

    return {
      provider: EMAIL_PROVIDERS.OPENROUTER,
      model: models[0] ?? DEFAULT_OPENROUTER_MODEL,
      latencyMs: Date.now() - startedAt,
      error: lastError,
    };
  }

  private resolveModels(): string[] {
    const primary = this.configService.get<string>('OPENROUTER_MODEL');
    const configuredModel =
      primary && isInstructModel(primary) ? primary : DEFAULT_OPENROUTER_MODEL;

    if (primary && !isInstructModel(primary)) {
      this.logger.warn(
        `OPENROUTER_MODEL "${primary}" is not for text generation — using ${configuredModel}`,
      );
    }

    const fallbacks = (
      this.configService.get<string>('OPENROUTER_FALLBACK_MODELS') ??
      DEFAULT_FALLBACK_MODELS.join(',')
    )
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model && isInstructModel(model));

    return [...new Set([configuredModel, ...fallbacks])];
  }
}
