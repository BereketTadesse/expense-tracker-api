// src/webhook/guards/webhook.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['authorization']?.replace('Bearer ', '');

    const expectedKey = this.configService.get<string>('WEBHOOK_SECRET_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('WEBHOOK_SECRET_KEY is not configured on server');
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing Webhook API key');
    }

    return true;
  }
}