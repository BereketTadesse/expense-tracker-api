import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'mail.apiKey') return 're_123456789';
        if (key === 'mail.from') return 'noreply@expensetracker.com';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendWelcomeEmail', () => {
    it('should invoke send method when resend client is initialized', async () => {
      const sendSpy = jest.spyOn((service as any).resend.emails, 'send').mockResolvedValue({
        data: { id: 'email-id-123' },
        error: null,
      });

      const result = await service.sendWelcomeEmail('user@example.com', 'Bereket Tadesse');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Welcome'),
        }),
      );
      expect(result).toEqual({ data: { id: 'email-id-123' }, error: null });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should invoke send method for password reset', async () => {
      const sendSpy = jest.spyOn((service as any).resend.emails, 'send').mockResolvedValue({
        data: { id: 'email-id-456' },
        error: null,
      });

      await service.sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Reset Your Expense Tracker Password'),
        }),
      );
    });
  });

  describe('sendBudgetAlert', () => {
    it('should send budget alert email successfully', async () => {
      const sendSpy = jest.spyOn((service as any).resend.emails, 'send').mockResolvedValue({
        data: { id: 'email-id-789' },
        error: null,
      });

      const result = await service.sendBudgetAlert('user@example.com', 'Groceries', 5000, 85);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Budget Alert',
        }),
      );
      expect(result).toEqual({ id: 'email-id-789' });
    });
  });
});
