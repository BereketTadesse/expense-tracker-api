// src/webhook/webhook.module.ts
import { Module } from '@nestjs/common';
import { SmsWebhookController } from './sms-webhook.controller';
import { WebhookService } from './services/webhook.service';
import { SmsParserService } from './services/sms-parser.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  controllers: [SmsWebhookController],
  providers: [WebhookService, SmsParserService],
  exports: [WebhookService],
})
export class WebhookModule {}