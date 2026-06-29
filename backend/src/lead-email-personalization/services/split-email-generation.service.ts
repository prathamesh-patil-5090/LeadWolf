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
  oppositeEmailProvider,
  parseGroqSplitPercent,
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
    return assignEmailProviderForLead(leadId, this.getGroqSplitPercent());
  }

  async generateForLead(
    leadId: string,
    context: OutreachEmailContext,
  ): Promise<ProviderGenerationResult> {
    const groqPercent = this.getGroqSplitPercent();
    const openRouterPercent = 100 - groqPercent;
    let provider = this.resolveProvider(leadId);

    if (!this.isProviderConfigured(provider)) {
      const fallback = oppositeEmailProvider(provider);
      if (this.isProviderConfigured(fallback)) {
        this.logger.warn(
          `Assigned provider ${provider} not configured for lead ${leadId} — using ${fallback}`,
        );
        provider = fallback;
      } else {
        return {
          provider: toSplitProviderLabel(provider),
          model: 'none',
          latencyMs: 0,
          error: `Neither GROQ_API_KEY nor OPENROUTER_API_KEY is configured`,
        };
      }
    }

    this.logger.log(
      `Email generation for lead ${leadId} → ${provider} (${groqPercent}/${openRouterPercent} split)`,
    );

    const primaryResult = await this.runProvider(provider, context);
    if (this.isSuccessfulResult(primaryResult)) {
      return primaryResult;
    }

    const fallback = oppositeEmailProvider(provider);
    if (!this.isProviderConfigured(fallback)) {
      return primaryResult;
    }

    this.logger.warn(
      `Primary provider ${provider} failed for lead ${leadId}${primaryResult.error ? `: ${primaryResult.error}` : ''} — retrying with ${fallback}`,
    );

    const fallbackResult = await this.runProvider(fallback, context);
    if (this.isSuccessfulResult(fallbackResult)) {
      return fallbackResult;
    }

    return fallbackResult.error ? fallbackResult : primaryResult;
  }

  private getGroqSplitPercent() {
    return parseGroqSplitPercent(
      this.configService.get<string>('EMAIL_PROVIDER_GROQ_PERCENT'),
    );
  }

  private isSuccessfulResult(result: ProviderGenerationResult) {
    return Boolean(result.draft?.subject && result.draft?.body);
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
        resolveGroqApiKey(this.configService.get<string>('GROQ_API_KEY')),
      );
    }

    return Boolean(this.configService.get<string>('OPENROUTER_API_KEY'));
  }
}
