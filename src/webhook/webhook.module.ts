// src/webhook/webhook.module.ts
import { Module } from '@nestjs/common';
import { SmsWebhookController } from './sms-webhook.controller';
import { WebhookService } from './services/webhook.service';
import { SmsParserService } from './services/sms-parser.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SmsWebhookController],
  providers: [WebhookService, SmsParserService], // 👈 Both services registered as providers
  exports: [WebhookService],
})
export class WebhookModule {}