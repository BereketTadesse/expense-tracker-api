import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedKey = this.configService.get<string>('WEBHOOK_SECRET_KEY');

    if (!expectedKey) {
      this.logger.error('WEBHOOK_SECRET_KEY is not configured in .env on server');
      throw new UnauthorizedException('WEBHOOK_SECRET_KEY is not configured on server');
    }

    // 1. Check Query Parameter fallback (e.g. ?apiKey=... or ?secret=...)
    const queryKey =
      request.query?.apiKey ||
      request.query?.apikey ||
      request.query?.secret ||
      request.query?.key;

    if (queryKey && String(queryKey).trim() === expectedKey.trim()) {
      return true;
    }

    // 2. Check API Key Header or Authorization Bearer
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['apikey'] ||
      request.headers['api-key'] ||
      request.headers['x-secret-key'] ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (apiKey && String(apiKey).trim() === expectedKey.trim()) {
      return true;
    }

    // 3. Check HMAC-SHA-256 Signature (X-Signature header)
    const signature = request.headers['x-signature'];
    if (signature && typeof signature === 'string') {
      const rawPayload =
        typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body || {});

      const hmac = crypto.createHmac('sha256', expectedKey.trim());
      hmac.update(rawPayload);
      const computedSignature = hmac.digest('hex');

      try {
        const sigBuf = Buffer.from(signature.trim().toLowerCase());
        const compBuf = Buffer.from(computedSignature.toLowerCase());
        if (sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf)) {
          return true;
        }
      } catch {
        // Fall through to UnauthorizedException
      }
    }

    this.logger.warn(
      `Unauthorized webhook request from ${request.ip}. Received headers: ${JSON.stringify(
        request.headers,
      )}`,
    );
    throw new UnauthorizedException('Invalid or missing Webhook API key / signature');
  }
}
