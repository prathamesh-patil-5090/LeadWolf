import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoWebhookService } from './brevo-webhook.service';

@Controller('webhooks/brevo')
export class BrevoWebhookController {
  private readonly logger = new Logger(BrevoWebhookController.name);

  constructor(
    private readonly brevoWebhookService: BrevoWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('transactional')
  @HttpCode(200)
  async handleTransactional(
    @Body() payload: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertAuthorized(authorization);

    const result =
      await this.brevoWebhookService.handleTransactionalEvent(payload);
    this.logger.debug(`Transactional webhook: ${JSON.stringify(result)}`);
    return result;
  }

  @Post('inbound')
  @HttpCode(200)
  async handleInbound(
    @Body() payload: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertAuthorized(authorization);

    const result = await this.brevoWebhookService.handleInboundReply(payload);
    this.logger.log(
      `Inbound reply webhook matched lead=${result.leadId ?? 'unknown'} from=${result.fromEmail ?? 'unknown'}`,
    );
    return result;
  }

  private assertAuthorized(authorization?: string) {
    const secret = this.configService.get<string>('BREVO_WEBHOOK_SECRET');
    if (!secret) {
      return;
    }

    const expected = `Bearer ${secret}`;
    if (authorization !== expected) {
      throw new UnauthorizedException('Invalid Brevo webhook authorization');
    }
  }
}
