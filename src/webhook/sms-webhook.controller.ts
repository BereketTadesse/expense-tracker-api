import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
  handleIncomingSms(
    @Body() processSmsDto: ProcessSmsDto,
    @CurrentUser() user?: User,
  ) {
    return this.webhookService.processIncomingSms(processSmsDto, user);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  handleHeartbeat(@Body() payload: Record<string, any>) {
    return this.webhookService.processHeartbeat(payload);
  }
}