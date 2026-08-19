import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Query, UnauthorizedException } from '@nestjs/common';
import { ProcessSmsDto } from './dto/process-sms.dto';
import { WebhookService } from './services/webhook.service';
import { WebhookGuard } from '../common/guards/webhook.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('webhook/sms')
@UseGuards(WebhookGuard)
export class SmsWebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleIncomingSms(
    @Body() processSmsDto: ProcessSmsDto,
    @Query('token') token?: string,
    @CurrentUser() jwtUser?: User,
  ) {
    let user = jwtUser;

    // Resolve user from personal webhook token if provided
    if (!user && token) {
      const resolved = await this.webhookService.resolveUserFromToken(token);
      if (!resolved) {
        throw new UnauthorizedException('Invalid webhook token. Please check your SMS Forwarder URL.');
      }
      user = resolved;
    }

    return this.webhookService.processIncomingSms(processSmsDto, user);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  handleHeartbeat(@Body() payload: Record<string, any>) {
    return this.webhookService.processHeartbeat(payload);
  }
}
