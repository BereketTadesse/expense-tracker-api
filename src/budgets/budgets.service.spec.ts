import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { Budget } from './entities/budget.entity';
import { Category } from '../categories/entities/category.entity';
import { Transaction } from '../transactions/entities/transactions.entity';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let categoryRepository: { findOne: jest.Mock };
  let transactionRepository: { createQueryBuilder: jest.Mock };
  let mailService: { sendBudgetAlert: jest.Mock };

  const mockUser = { id: 1, email: 'test@example.com' } as User;
  const mockCategory = { id: 'cat-uuid-1', name: 'Groceries' } as Category;

  beforeEach(async () => {
    budgetRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    categoryRepository = {
      findOne: jest.fn(),
    };

    transactionRepository = {
      createQueryBuilder: jest.fn(),
    };

    mailService = {
      sendBudgetAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getRepositoryToken(Budget), useValue: budgetRepository },
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if category is missing', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { categoryId: 'invalid-cat', amount: 5000, week: 32, month: 8, year: 2026 },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if budget already exists for week/month/year', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory);
      budgetRepository.findOne.mockResolvedValue({ id: 10 });

      await expect(
        service.create(
          { categoryId: 'cat-uuid-1', amount: 5000, week: 32, month: 8, year: 2026 },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and save budget', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory);
      budgetRepository.findOne.mockResolvedValue(null);
      const newBudget = { id: 1, amountLimit: 5000, category: mockCategory, user: mockUser };
      budgetRepository.create.mockReturnValue(newBudget);
      budgetRepository.save.mockResolvedValue(newBudget);

      const result = await service.create(
        { categoryId: 'cat-uuid-1', amount: 5000, week: 32, month: 8, year: 2026 },
        mockUser,
      );

      expect(budgetRepository.save).toHaveBeenCalled();
      expect(result).toEqual(newBudget);
    });
  });

  describe('getMonthlyBudgetSummary', () => {
    it('should return empty array if no budgets set', async () => {
      budgetRepository.find.mockResolvedValue([]);

      const summaries = await service.getMonthlyBudgetSummary(8, 2026, mockUser);
      expect(summaries).toEqual([]);
    });

    it('should calculate spending, remaining amount, and status correctly', async () => {
      const budgets = [
        { id: 1, amountLimit: 1000, week: 32, category: mockCategory },
      ];
      budgetRepository.find.mockResolvedValue(budgets);

      const qbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: 850 }),
      };
      transactionRepository.createQueryBuilder.mockReturnValue(qbMock);

      const summaries = await service.getMonthlyBudgetSummary(8, 2026, mockUser);

      expect(summaries.length).toBe(1);
      expect(summaries[0].spentAmount).toBe(850);
      expect(summaries[0].remainingAmount).toBe(150);
      expect(summaries[0].percentageUsed).toBe(85);
      expect(summaries[0].status).toBe('WARNING');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if budget not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await expect(service.update(99, { amount: 2000 }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should update budget amountLimit', async () => {
      const budget = { id: 1, amountLimit: 1000 };
      budgetRepository.findOne.mockResolvedValue(budget);
      budgetRepository.save.mockImplementation((b) => Promise.resolve(b));

      const updated = await service.update(1, { amount: 3000 }, mockUser);
      expect(updated.amountLimit).toBe(3000);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if budget not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should remove budget successfully', async () => {
      const budget = { id: 1 };
      budgetRepository.findOne.mockResolvedValue(budget);
      budgetRepository.remove.mockResolvedValue(budget);

      const result = await service.remove(1, mockUser);
      expect(result).toEqual({ message: 'budget removed successfully' });
    });
  });
});
