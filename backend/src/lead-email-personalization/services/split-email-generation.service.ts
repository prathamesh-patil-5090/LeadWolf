import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutreachEmailContext,
  ProviderGenerationResult,
} from '../interfaces/email-generation.interface';
import { GroqEmailGenerator } from '../providers/groq-email.generator';
import { OpenRouterEmailGenerator } from '../providers/openrouter-email.generator';
import { resolveGroqApiKey } from '../../shared/llm/llm-credentials.util';
import {
  assignEmailProviderForLead,
  SplitEmailProvider,
  toSplitProviderLabel,
} from '../utils/email-provider-split.util';

@Injectable()
export class SplitEmailGenerationService {
  private readonly logger = new Logger(SplitEmailGenerationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly groqGenerator: GroqEmailGenerator,
    private readonly openRouterGenerator: OpenRouterEmailGenerator,
  ) {}

  resolveProvider(leadId: string): SplitEmailProvider {
    return assignEmailProviderForLead(leadId);
  }

  async generateForLead(
    leadId: string,
    context: OutreachEmailContext,
  ): Promise<ProviderGenerationResult> {
    const provider = this.resolveProvider(leadId);

    if (!this.isProviderConfigured(provider)) {
      const fallback = provider === 'groq' ? 'openrouter' : 'groq';
      if (this.isProviderConfigured(fallback)) {
        this.logger.warn(
          `Assigned provider ${provider} not configured for lead ${leadId} — using ${fallback}`,
        );
        return this.runProvider(fallback, context);
      }

      return {
        provider: toSplitProviderLabel(provider),
        model: 'none',
        latencyMs: 0,
        error: `Neither GROQ_API_KEY nor OPENROUTER_API_KEY is configured`,
      };
    }

    this.logger.log(
      `Email generation for lead ${leadId} → ${provider} (50/50 split)`,
    );

    return this.runProvider(provider, context);
  }

  private async runProvider(
    provider: SplitEmailProvider,
    context: OutreachEmailContext,
  ) {
    if (provider === 'groq') {
      return this.groqGenerator.generate(context);
    }

    return this.openRouterGenerator.generate(context);
  }

  private isProviderConfigured(provider: SplitEmailProvider) {
    if (provider === 'groq') {
      return Boolean(
        resolveGroqApiKey(
          this.configService.get<string>('GROQ_API_KEY'),
          this.configService.get<string>('XAI_API_KEY'),
        ),
      );
    }

    return Boolean(this.configService.get<string>('OPENROUTER_API_KEY'));
  }
}
