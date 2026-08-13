import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account, AccountType } from './entities/accounts.entity';
import { User } from '../users/entities/user.entity';
import { Currency } from '../common/enums/currency.enum';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softRemove: jest.Mock;
    manager: { findOne: jest.Mock; save: jest.Mock };
  };
  let dataSource: { transaction: jest.Mock };

  const mockUser = { id: 1 } as User;

  beforeEach(async () => {
    accountRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      softRemove: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: accountRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new account', async () => {
      const dto = { name: 'CBE Account', type: AccountType.CHECKING, balance: 1000 };
      const createdAccount = { ...dto, user: mockUser };
      accountRepository.create.mockReturnValue(createdAccount);
      accountRepository.save.mockResolvedValue({ id: 'acc-1', ...createdAccount });

      const result = await service.create(dto as any, mockUser);

      expect(accountRepository.create).toHaveBeenCalledWith({ ...dto, user: mockUser });
      expect(result.id).toBe('acc-1');
    });
  });

  describe('findAll', () => {
    it('should return user accounts', async () => {
      const accounts = [{ id: 'acc-1', name: 'CBE' }];
      accountRepository.find.mockResolvedValue(accounts);

      const result = await service.findAll(mockUser);
      expect(result).toEqual(accounts);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if account not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should return account when found', async () => {
      const account = { id: 'acc-1', name: 'CBE' };
      accountRepository.findOne.mockResolvedValue(account);

      const result = await service.findOne('acc-1', mockUser);
      expect(result).toEqual(account);
    });
  });

  describe('findAccountBySms', () => {
    it('should match account by senderHeader and accountMask', async () => {
      const accounts = [
        { id: 'acc-1', senderHeader: 'CBE', accountMask: '3866' },
        { id: 'acc-2', senderHeader: 'Telebirr', accountMask: null },
      ] as Account[];

      jest.spyOn(service, 'findAll').mockResolvedValue(accounts);

      const result = await service.findAccountBySms('CBE', 'Your account 3866 was debited', mockUser);
      expect(result?.id).toBe('acc-1');
    });

    it('should return null if no account matches SMS body', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await service.findAccountBySms('UNKNOWN', 'Unmatched SMS body', mockUser);
      expect(result).toBeNull();
    });
  });

  describe('updateBalance', () => {
    it('should throw NotFoundException if account is missing', async () => {
      accountRepository.manager.findOne.mockResolvedValue(null);

      await expect(service.updateBalance('acc-1', 100, 'EXPENSE')).rejects.toThrow(NotFoundException);
    });

    it('should mutate balance correctly for EXPENSE', async () => {
      const account = { id: 'acc-1', balance: 500 };
      accountRepository.manager.findOne.mockResolvedValue(account);
      accountRepository.manager.save.mockImplementation((a) => Promise.resolve(a));

      const updated = await service.updateBalance('acc-1', 200, 'EXPENSE');
      expect(updated.balance).toBe(300);
    });

    it('should mutate balance correctly for INCOME', async () => {
      const account = { id: 'acc-1', balance: 500 };
      accountRepository.manager.findOne.mockResolvedValue(account);
      accountRepository.manager.save.mockImplementation((a) => Promise.resolve(a));

      const updated = await service.updateBalance('acc-1', 200, 'INCOME');
      expect(updated.balance).toBe(700);
    });
  });

  describe('transfer', () => {
    it('should throw BadRequestException if source and dest account are same', async () => {
      await expect(
        service.transfer({ fromAccountId: 'acc-1', toAccountId: 'acc-1', amount: 100 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'acc-1', balance: 50 })
          .mockResolvedValueOnce({ id: 'acc-2', balance: 200 }),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      await expect(
        service.transfer({ fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 100 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should execute transfer cleanly when funds are available', async () => {
      const source = { id: 'acc-1', name: 'Source', balance: 500, currency: Currency.ETB };
      const dest = { id: 'acc-2', name: 'Dest', balance: 200, currency: Currency.ETB };

      const mockManager = {
        findOne: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(dest),
        save: jest.fn().mockResolvedValue([source, dest]),
      };

      dataSource.transaction.mockImplementation(async (cb) => cb(mockManager));

      const result = await service.transfer(
        { fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 100 },
        mockUser,
      );

      expect(result.sourceAccount.newBalance).toBe(400);
      expect(result.destinationAccount.newBalance).toBe(300);
    });
  });

  describe('getSummary', () => {
    it('should aggregate net worth and type breakdown', async () => {
      const accounts = [
        { id: 'acc-1', balance: 1000, type: AccountType.CHECKING },
        { id: 'acc-2', balance: 500, type: AccountType.MOBILE_WALLET },
      ] as Account[];

      jest.spyOn(service, 'findAll').mockResolvedValue(accounts);

      const summary = await service.getSummary(mockUser);

      expect(summary.totalNetWorth).toBe(1500);
      expect(summary.accountCount).toBe(2);
      expect(summary.breakdownByType[AccountType.CHECKING]).toBe(1000);
      expect(summary.breakdownByType[AccountType.MOBILE_WALLET]).toBe(500);
    });
  });
});
