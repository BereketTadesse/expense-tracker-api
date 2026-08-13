import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './entities/transactions.entity';
import { AccountsService } from '../accounts/accounts.service';
import { User } from '../users/entities/user.entity';
import { Account } from '../accounts/entities/accounts.entity';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionRepository: {
    createQueryBuilder: jest.Mock;
  };
  let accountsService: {
    updateBalance: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  const mockUser = { id: 1 } as User;

  beforeEach(async () => {
    transactionRepository = {
      createQueryBuilder: jest.fn(),
    };

    accountsService = {
      updateBalance: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: AccountsService, useValue: accountsService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if target account does not exist', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await expect(
        service.create(
          { amount: 500, type: TransactionType.EXPENSE, note: 'Lunch', accountId: 'acc-1' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deduct balance for EXPENSE and save transaction', async () => {
      const account = { id: 'acc-1', balance: 1000 };
      const savedTxn = { id: 'txn-1', amount: 300, type: 'EXPENSE' };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(account),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
        create: jest.fn().mockReturnValue(savedTxn),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.create(
        { amount: 300, type: TransactionType.EXPENSE, note: 'Groceries', accountId: 'acc-1' },
        mockUser,
      );

      expect(account.balance).toBe(700);
      expect(result).toEqual(savedTxn);
    });

    it('should add balance for INCOME', async () => {
      const account = { id: 'acc-1', balance: 1000 };
      const savedTxn = { id: 'txn-2', amount: 500, type: 'INCOME' };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(account),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
        create: jest.fn().mockReturnValue(savedTxn),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await service.create(
        { amount: 500, type: TransactionType.INCOME, note: 'Salary', accountId: 'acc-1' },
        mockUser,
      );

      expect(account.balance).toBe(1500);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if transaction not found', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await expect(service.remove('invalid-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should reverse transaction balance and remove transaction entity', async () => {
      const existingTxn = {
        id: 'txn-1',
        amount: 200,
        type: TransactionType.EXPENSE,
        account: { id: 'acc-1', name: 'CBE Account' },
      };

      const updatedAccount = { name: 'CBE Account', balance: 1200 };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(existingTxn),
        remove: jest.fn().mockResolvedValue(existingTxn),
      };

      accountsService.updateBalance.mockResolvedValue(updatedAccount);
      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.remove('txn-1', mockUser);

      expect(accountsService.updateBalance).toHaveBeenCalledWith('acc-1', 200, 'INCOME', mockManager);
      expect(mockManager.remove).toHaveBeenCalledWith(Transaction, existingTxn);
      expect(result.success).toBe(true);
      expect(result.data.reversedAmount).toBe(200);
    });
  });

  describe('getMonthlyOverview', () => {
    it('should compute total income, expense, net savings, and savings rate percentage', async () => {
      const qbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalIncome: '10000', totalExpense: '4000' }),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(qbMock);

      const overview = await service.getMonthlyOverview(8, 2026, mockUser);

      expect(overview.totalIncome).toBe(10000);
      expect(overview.totalExpense).toBe(4000);
      expect(overview.netSavings).toBe(6000);
      expect(overview.savingsRatePercentage).toBe(60);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should calculate category spending distribution percentages', async () => {
      const rawData = [
        { categoryName: 'Groceries', totalSpent: '3000' },
        { categoryName: 'Rent', totalSpent: '7000' },
      ];

      const qbMock = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(qbMock);

      const breakdown = await service.getCategoryBreakdown(8, 2026, mockUser);

      expect(breakdown.length).toBe(2);
      expect(breakdown[0].categoryName).toBe('Groceries');
      expect(breakdown[0].percentage).toBe(30);
      expect(breakdown[1].categoryName).toBe('Rent');
      expect(breakdown[1].percentage).toBe(70);
    });
  });
});
