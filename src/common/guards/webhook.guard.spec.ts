import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookGuard } from './webhook.guard';
import * as crypto from 'crypto';

describe('WebhookGuard', () => {
  let guard: WebhookGuard;
  let configService: jest.Mocked<ConfigService>;

  const mockSecretKey = 'super-secret-key';

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(mockSecretKey),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new WebhookGuard(configService);
  });

  function createMockExecutionContext(headers: Record<string, string>, body: any = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          body,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access with matching x-api-key header', () => {
    const context = createMockExecutionContext({ 'x-api-key': mockSecretKey });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with matching Authorization Bearer token', () => {
    const context = createMockExecutionContext({ authorization: `Bearer ${mockSecretKey}` });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access with valid HMAC-SHA-256 signature in X-Signature header', () => {
    const body = { from: 'CBE', text: 'debited with ETB 100' };
    const rawBody = JSON.stringify(body);
    const signature = crypto.createHmac('sha256', mockSecretKey).update(rawBody).digest('hex');

    const context = createMockExecutionContext({ 'x-signature': signature }, body);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject when signature is invalid', () => {
    const body = { from: 'CBE', text: 'debited with ETB 100' };
    const invalidSignature = 'invalid-hex-signature-123456';

    const context = createMockExecutionContext({ 'x-signature': invalidSignature }, body);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject when headers are missing', () => {
    const context = createMockExecutionContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw if WEBHOOK_SECRET_KEY is not configured on server', () => {
    configService.get.mockReturnValue(undefined);
    const context = createMockExecutionContext({ 'x-api-key': mockSecretKey });
    expect(() => guard.canActivate(context)).toThrow('WEBHOOK_SECRET_KEY is not configured on server');
  });
});
