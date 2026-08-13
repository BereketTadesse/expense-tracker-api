import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { WebhookService } from './webhook.service';
import { SmsParserService, ParsedSmsResult } from './sms-parser.service';
import { ProcessSmsDto } from '../dto/process-sms.dto';
import { User } from '../../users/entities/user.entity';
import { Account, AccountType } from '../../accounts/entities/accounts.entity';
import { Transaction, TransactionType } from '../../transactions/entities/transactions.entity';

describe('WebhookService', () => {
  let service: WebhookService;
  let smsParserService: jest.Mocked<SmsParserService>;
  let dataSource: jest.Mocked<DataSource>;
  let mockEntityManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  // Mock User
  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedpassword',
    name: 'Bereket Tadesse',
    resetPasswordToken: null,
    resetPasswordExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
  };

  beforeEach(async () => {
    // 1. Create a mocked EntityManager to pass into dataSource.transaction()
    mockEntityManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // 2. Mock DataSource to execute the callback using mockEntityManager
    const mockDataSource = {
      transaction: jest.fn(async (cb: (manager: EntityManager) => Promise<any>) => {
        return await cb(mockEntityManager as unknown as EntityManager);
      }),
    };

    // 3. Mock SmsParserService
    const mockSmsParserService = {
      parseSms: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: SmsParserService, useValue: mockSmsParserService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    smsParserService = module.get(SmsParserService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST CASE 1: Unrecognized SMS Format Handling
  // -------------------------------------------------------------------------
  describe('processIncomingSms - Unrecognized SMS', () => {
    it('should return success: false when SMS parser returns null', async () => {
      const dto: ProcessSmsDto = {
        sender: 'UNKNOWN',
        message: 'Random promo text message',
      };

      smsParserService.parseSms.mockReturnValue(null);

      const result = await service.processIncomingSms(dto, mockUser);

      expect(smsParserService.parseSms).toHaveBeenCalledWith(dto.sender, dto.message);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'SMS message did not match any recognized bank regex pattern. Skipped.',
      });
    });
  });

  // -------------------------------------------------------------------------
  // TEST CASE 2: Idempotency Protection (Duplicate Reference ID)
  // -------------------------------------------------------------------------
  describe('processIncomingSms - Idempotency Check', () => {
    it('should throw BadRequestException if transaction with referenceId already exists', async () => {
      const dto: ProcessSmsDto = {
        sender: '127',
        message: 'You have transferred ETB 150.00 to Kaldi. Receipt No. AJM22EAGFK.',
      };

      const parsedData: ParsedSmsResult = {
        amount: 150,
        type: 'EXPENSE',
        description: "Kaldi's Coffee",
        referenceId: 'AJM22EAGFK', // 👈 Duplicate ID
        accountMask: 'telebirr',
        bankName: 'Telebirr',
      };

      smsParserService.parseSms.mockReturnValue(parsedData);

      // Simulate finding an existing transaction with the same referenceId
      mockEntityManager.findOne.mockResolvedValueOnce({
        id: 'existing-txn-uuid',
        referenceId: 'AJM22EAGFK',
      } as Transaction);

      await expect(service.processIncomingSms(dto, mockUser)).rejects.toThrow(
        new BadRequestException(
          "Duplicate SMS: Transaction with Reference ID 'AJM22EAGFK' has already been processed.",
        ),
      );

      expect(mockEntityManager.findOne).toHaveBeenCalledWith(Transaction, {
        where: { referenceId: 'AJM22EAGFK' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // TEST CASE 3: JIT Auto-Creation of Missing Account
  // -------------------------------------------------------------------------
  describe('processIncomingSms - JIT Account Creation', () => {
    it('should auto-create a new account if no matching account is found', async () => {
      const dto: ProcessSmsDto = {
        sender: 'CBE',
        message: 'Dear Customer your Account 1********3866 has been debited with ETB 500.00. Balance is ETB 28,000.00.',
      };

      const parsedData: ParsedSmsResult = {
        amount: 500,
        type: 'EXPENSE',
        description: 'CBE Transaction (...3866)',
        accountMask: '3866',
        extractedBalance: 28000,
        bankName: 'CBE',
      };

      smsParserService.parseSms.mockReturnValue(parsedData);

      // 1st findOne (Idempotency): No duplicate ref ID
      mockEntityManager.findOne.mockResolvedValueOnce(null);
      // 2nd findOne (Account Lookup): No existing account found
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      const mockNewAccount: Account = {
        id: 'new-account-uuid',
        name: 'CBE (...3866)',
        type: AccountType.CHECKING,
        balance: 28000,
        senderHeader: 'CBE',
        accountMask: '3866',
        user: mockUser,
      } as Account;

      const mockNewTxn: Transaction = {
        id: 'new-txn-uuid',
        amount: 500,
        type: TransactionType.EXPENSE,
        description: 'CBE Transaction (...3866)',
        account: mockNewAccount,
        user: mockUser,
      } as Transaction;

      mockEntityManager.create.mockReturnValueOnce(mockNewAccount); // For Account
      mockEntityManager.save.mockResolvedValueOnce(mockNewAccount); // For Account save
      mockEntityManager.create.mockReturnValueOnce(mockNewTxn);     // For Transaction
      mockEntityManager.save.mockResolvedValueOnce(mockNewTxn);     // For Transaction save

      const result = await service.processIncomingSms(dto, mockUser);

      expect(result.success).toBe(true);
      expect(result.data?.isNewAccountCreated).toBe(true);
      expect(result.data?.accountName).toBe('CBE (...3866)');
      expect(result.data?.currentBalance).toBe(28000);
    });
  });

  // -------------------------------------------------------------------------
  // TEST CASE 4: Existing Account Balance Mutation
  // -------------------------------------------------------------------------
  describe('processIncomingSms - Existing Account Balance Update', () => {
    it('should update existing account balance and log transaction', async () => {
      const dto: ProcessSmsDto = {
        sender: '127',
        message: 'You have transferred ETB 200.00. Receipt No. REF9988.',
      };

      const parsedData: ParsedSmsResult = {
        amount: 200,
        type: 'EXPENSE',
        description: 'Telebirr Payment',
        referenceId: 'REF9988',
        accountMask: 'telebirr',
        bankName: 'Telebirr',
      };

      smsParserService.parseSms.mockReturnValue(parsedData);

      // 1st findOne (Idempotency): No duplicate transaction
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      // 2nd findOne (Account Lookup): Existing Telebirr account found
      const existingAccount: Account = {
        id: 'existing-telebirr-uuid',
        name: 'Telebirr Wallet',
        balance: 1000,
        type: AccountType.MOBILE_WALLET,
        user: mockUser,
      } as Account;

      mockEntityManager.findOne.mockResolvedValueOnce(existingAccount);

      const updatedAccount = { ...existingAccount, balance: 800 }; // 1000 - 200
      const mockTxn = { id: 'txn-uuid', amount: 200, account: updatedAccount } as Transaction;

      mockEntityManager.save.mockResolvedValueOnce(updatedAccount); // Save updated account
      mockEntityManager.create.mockReturnValueOnce(mockTxn);       // Create Txn
      mockEntityManager.save.mockResolvedValueOnce(mockTxn);       // Save Txn

      const result = await service.processIncomingSms(dto, mockUser);

      expect(result.success).toBe(true);
      expect(result.data?.isNewAccountCreated).toBe(false);
      expect(result.data?.currentBalance).toBe(800);
    });
  });
});
