import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedKey = this.configService.get<string>('WEBHOOK_SECRET_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('WEBHOOK_SECRET_KEY is not configured on server');
    }

    // 1. Check API Key Header or Authorization Bearer
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (apiKey && apiKey === expectedKey) {
      return true;
    }

    // 2. Check HMAC-SHA-256 Signature (X-Signature header)
    const signature = request.headers['x-signature'];
    if (signature && typeof signature === 'string') {
      const rawPayload =
        typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body || {});

      const hmac = crypto.createHmac('sha256', expectedKey);
      hmac.update(rawPayload);
      const computedSignature = hmac.digest('hex');

      try {
        const sigBuf = Buffer.from(signature.toLowerCase());
        const compBuf = Buffer.from(computedSignature.toLowerCase());
        if (sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf)) {
          return true;
        }
      } catch {
        // Fall through to UnauthorizedException
      }
    }

    throw new UnauthorizedException('Invalid or missing Webhook API key / signature');
  }
}