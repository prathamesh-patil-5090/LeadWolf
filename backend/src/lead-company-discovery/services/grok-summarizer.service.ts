import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanySummaryResult } from '../interfaces/company-discovery.interface';

interface GrokSummaryPayload {
  companyName: string;
  leadRole: string;
  website: string;
  scrapedContent: string;
}

@Injectable()
export class GrokSummarizerService {
  private readonly logger = new Logger(GrokSummarizerService.name);

  constructor(private readonly configService: ConfigService) {}

  async summarize(input: GrokSummaryPayload): Promise<CompanySummaryResult | null> {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('XAI_API_KEY not set — skipping company summary');
      return null;
    }

    const model = this.configService.get<string>('XAI_MODEL', 'grok-3-mini');
    const prompt = this.buildPrompt(input);

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You help write personalized cold outreach to technical professionals. Return valid JSON only, no markdown fences.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`Grok API error ${response.status}: ${body.slice(0, 200)}`);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return null;
      }

      return this.parseSummaryResponse(content);
    } catch (error) {
      this.logger.warn(
        `Grok summarization failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private buildPrompt(input: GrokSummaryPayload): string {
    return `Analyze this company website content and return JSON for cold-email personalization.

Company: ${input.companyName}
Website: ${input.website}
Target lead role: ${input.leadRole}

Scraped website content:
${input.scrapedContent}

Return JSON with this exact shape:
{
  "summary": "150-250 word overview of what the company does, their product focus, and target market",
  "industry": "short industry label",
  "products": "comma-separated main products or services",
  "personalizationHooks": ["3-5 specific angles to mention in outreach, each one sentence"]
}`;
  }

  private parseSummaryResponse(content: string): CompanySummaryResult | null {
    const jsonText = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(jsonText) as Partial<CompanySummaryResult>;
      if (!parsed.summary?.trim()) {
        return null;
      }

      return {
        summary: parsed.summary.trim(),
        industry: parsed.industry?.trim(),
        products: parsed.products?.trim(),
        personalizationHooks: Array.isArray(parsed.personalizationHooks)
          ? parsed.personalizationHooks
              .filter((hook): hook is string => typeof hook === 'string')
              .map((hook) => hook.trim())
              .filter(Boolean)
          : [],
      };
    } catch {
      return {
        summary: jsonText.slice(0, 2000),
        personalizationHooks: [],
      };
    }
  }
}
