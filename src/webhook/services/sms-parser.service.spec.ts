import { Test, TestingModule } from '@nestjs/testing';
import { SmsParserService } from './sms-parser.service';

describe('SmsParserService', () => {
  let service: SmsParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmsParserService],
    }).compile();

    service = module.get<SmsParserService>(SmsParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CBE Parsing', () => {
    it('should parse debit SMS correctly', () => {
      const result = service.parseSms(
        'CBE',
        'Dear Customer your Account 1********3866 has been debited with ETB 500.00 on 12/08/2026. Your Current Balance is ETB 28,036.28.',
      );

      expect(result).toEqual({
        amount: 500,
        type: 'EXPENSE',
        description: 'CBE Transaction (...3866)',
        referenceId: undefined,
        accountMask: '3866',
        extractedBalance: 28036.28,
        bankName: 'CBE',
      });
    });

    it('should parse credit SMS correctly', () => {
      const result = service.parseSms(
        'CBE',
        'Dear Customer your Account 1********3866 has been credited with ETB 1,200.00. Current Balance is ETB 29,236.28.',
      );

      expect(result).toEqual({
        amount: 1200,
        type: 'INCOME',
        description: 'CBE Transaction (...3866)',
        referenceId: undefined,
        accountMask: '3866',
        extractedBalance: 29236.28,
        bankName: 'CBE',
      });
    });
  });

  describe('Telebirr Parsing', () => {
    it('should parse transfer/expense SMS correctly', () => {
      const result = service.parseSms(
        '127',
        "You have transferred ETB 250.00 to Kaldi's Coffee. Receipt No. AJM22EAGFK. Your new balance is ETB 1,200.00.",
      );

      expect(result).toEqual({
        amount: 250,
        type: 'EXPENSE',
        description: "Kaldi's Coffee",
        referenceId: 'AJM22EAGFK',
        accountMask: 'telebirr',
        extractedBalance: 1200,
        bankName: 'Telebirr',
      });
    });

    it('should parse received/income SMS correctly', () => {
      const result = service.parseSms(
        'TELEBIRR',
        'You have received ETB 1,000.00 from Abebe. Receipt No. RX112233. Your new balance is ETB 2,200.00.',
      );

      expect(result).toEqual({
        amount: 1000,
        type: 'INCOME',
        description: 'Telebirr Transaction',
        referenceId: 'RX112233',
        accountMask: 'telebirr',
        extractedBalance: 2200,
        bankName: 'Telebirr',
      });
    });
  });

  describe('Bank of Abyssinia (BOA) Parsing', () => {
    it('should parse debited SMS correctly', () => {
      const result = service.parseSms(
        'ABYSSINIA',
        'Dear customer, your account 12****89 has been debited with ETB 1,200.00. Ref: BOA9912. Balance: ETB 14,000.00',
      );

      expect(result).toEqual({
        amount: 1200,
        type: 'EXPENSE',
        description: 'BOA Transaction (...**89)',
        referenceId: 'BOA9912',
        accountMask: '**89',
        extractedBalance: 14000,
        bankName: 'Bank of Abyssinia',
      });
    });
  });

  describe('Unrecognized Format', () => {
    it('should return null for unmatched SMS messages', () => {
      const result = service.parseSms('UNKNOWN_SENDER', 'Hello promotion text message');
      expect(result).toBeNull();
    });
  });
});
