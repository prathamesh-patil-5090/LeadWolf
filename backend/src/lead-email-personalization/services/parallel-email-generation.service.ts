import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutreachEmailContext,
  ProviderGenerationResult,
} from '../interfaces/email-generation.interface';
import { GrokEmailGenerator } from '../providers/grok-email.generator';
import { GroqEmailGenerator } from '../providers/groq-email.generator';
import { OpenRouterEmailGenerator } from '../providers/openrouter-email.generator';
import {
  resolveGroqApiKey,
  resolveXaiApiKey,
} from '../../shared/llm/llm-credentials.util';

@Injectable()
export class ParallelEmailGenerationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly grokGenerator: GrokEmailGenerator,
    private readonly groqGenerator: GroqEmailGenerator,
    private readonly openRouterGenerator: OpenRouterEmailGenerator,
  ) {}

  async generateInParallel(
    context: OutreachEmailContext,
  ): Promise<ProviderGenerationResult[]> {
    const tasks: Array<Promise<ProviderGenerationResult>> = [];

    if (resolveXaiApiKey(this.configService.get<string>('XAI_API_KEY'))) {
      tasks.push(this.grokGenerator.generate(context));
    }

    if (
      resolveGroqApiKey(
        this.configService.get<string>('GROQ_API_KEY'),
        this.configService.get<string>('XAI_API_KEY'),
      )
    ) {
      tasks.push(this.groqGenerator.generate(context));
    }

    if (this.configService.get<string>('OPENROUTER_API_KEY')) {
      tasks.push(this.openRouterGenerator.generate(context));
    }

    if (!tasks.length) {
      return [
        {
          provider: 'none',
          model: 'none',
          latencyMs: 0,
          error:
            'No LLM API keys configured. Set GROQ_API_KEY, XAI_API_KEY (xai-...), or OPENROUTER_API_KEY',
        },
      ];
    }

    const results = await Promise.allSettled(tasks);

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        provider: 'unknown',
        model: 'unknown',
        latencyMs: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Provider request failed',
      };
    });
  }
}
