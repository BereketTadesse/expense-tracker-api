import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Transaction } from '../transactions/entities/transactions.entity';
import { MailService } from '../mail/mail.service';

export interface BudgetSummaryResponse {
  budgetId: number;
  categoryId: string;
  categoryName: string;
  week: number;
  month: number;
  year: number;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED';
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly mailService: MailService,
  ) {}

  // 1. Create a New Budget
  async create(createBudgetDto: CreateBudgetDto, user: User): Promise<Budget> {
    const { categoryId, amount, week, month, year } = createBudgetDto;

    const category = await this.categoryRepository.findOne({
      where: [
        { id: categoryId, user: { id: user.id } },
        { id: categoryId, isDefault: true },
      ],
    });

    if (!category) {
      throw new NotFoundException(`Category not found`);
    }

    // Check unique constraint manually for clean error response
    const existingBudget = await this.budgetRepository.findOne({
      where: {
        user: { id: user.id },
        category: { id: category.id },
        week,
        month,
        year,
      },
    });

    if (existingBudget) {
      throw new ConflictException(
        `A budget for '${category.name}' in week ${week}, ${month}/${year} already exists. Use Edit to update it.`,
      );
    }

    const budget = this.budgetRepository.create({
      amountLimit: amount,
      week,
      month,
      year,
      category,
      user,
    });

    return await this.budgetRepository.save(budget);
  }

  // 2. Dynamic Monthly Spending Summary Calculation
  async getMonthlyBudgetSummary(
    month: number,
    year: number,
    user: User,
  ): Promise<BudgetSummaryResponse[]> {
    const budgets = await this.budgetRepository.find({
      where: { user: { id: user.id }, month, year },
      relations: { category: true },
    });

    if (budgets.length === 0) {
      return [];
    }

    const summaries: BudgetSummaryResponse[] = [];

    for (const budget of budgets) {
      // 🧮 Dynamic SUM Query: Calculates expenses for this category & month
      const { sum } = await this.transactionRepository
        .createQueryBuilder('txn')
        .select('SUM(txn.amount)', 'sum')
        .where('txn.user = :userId', { userId: user.id })
        .andWhere('txn.category = :categoryId', { categoryId: budget.category.id })
        .andWhere('txn.type = :type', { type: 'EXPENSE' })
        .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
        .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
        .getRawOne();

      const budgetAmount = Number(budget.amountLimit);
      const spentAmount = Number(sum) || 0;
      const remainingAmount = budgetAmount - spentAmount;
      const percentageUsed = budgetAmount > 0 
        ? Number(((spentAmount / budgetAmount) * 100).toFixed(1))
        : 0;

      let status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED' = 'ON_TRACK';
      if (percentageUsed >= 100) {
        status = 'EXCEEDED';
      } else if (percentageUsed >= 80) {
        status = 'WARNING';
      }

      summaries.push({
        budgetId: budget.id,
        categoryId: budget.category.id,
        categoryName: budget.category.name,
        week: budget.week,
        month,
        year,
        budgetAmount,
        spentAmount,
        remainingAmount,
        percentageUsed,
        status,
      });
    }

    return summaries;
  }

  // 3. Dynamic Weekly Spending Summary Calculation
  async getWeeklyBudgetSummary(
    week: number,
    month: number,
    year: number,
    user: User,
  ): Promise<BudgetSummaryResponse[]> {
    const budgets = await this.budgetRepository.find({
      where: { user: { id: user.id }, week, month, year },
      relations: { category: true },
    });

    if (budgets.length === 0) {
      return [];
    }

    const summaries: BudgetSummaryResponse[] = [];

    for (const budget of budgets) {
      // 🧮 Dynamic SUM Query: Calculates expenses for this category, week, month & year
      const { sum } = await this.transactionRepository
        .createQueryBuilder('txn')
        .select('SUM(txn.amount)', 'sum')
        .where('txn.user = :userId', { userId: user.id })
        .andWhere('txn.category = :categoryId', { categoryId: budget.category.id })
        .andWhere('txn.type = :type', { type: 'EXPENSE' })
        .andWhere('EXTRACT(WEEK FROM txn.date) = :week', { week })
        .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
        .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
        .getRawOne();

      const budgetAmount = Number(budget.amountLimit);
      const spentAmount = Number(sum) || 0;
      const remainingAmount = budgetAmount - spentAmount;
      const percentageUsed = budgetAmount > 0 
        ? Number(((spentAmount / budgetAmount) * 100).toFixed(1))
        : 0;

      let status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED' = 'ON_TRACK';
      if (percentageUsed >= 100) {
        status = 'EXCEEDED';
      } else if (percentageUsed >= 80) {
        status = 'WARNING';
      }

      summaries.push({
        budgetId: budget.id,
        categoryId: budget.category.id,
        categoryName: budget.category.name,
        week: budget.week,
        month,
        year,
        budgetAmount,
        spentAmount,
        remainingAmount,
        percentageUsed,
        status,
      });
    }

    return summaries;
  }

  // 4. Check & Trigger Resend Email Alerts (Called when a new expense is logged)
  async checkBudgetAlerts(user: User, categoryId: string, txnDate: Date): Promise<void> {
    const month = txnDate.getMonth() + 1; // 1-12
    const year = txnDate.getFullYear();
    const week = getIsoWeek(txnDate);

    // A. Check Monthly Budget Alerts
    const monthlyBudgets = await this.budgetRepository.find({
      where: {
        user: { id: user.id },
        category: { id: categoryId },
        month,
        year,
      },
      relations: { category: true },
    });

    for (const budget of monthlyBudgets) {
      const summaries = await this.getMonthlyBudgetSummary(month, year, user);
      const targetSummary = summaries.find((s) => s.budgetId === budget.id);

      if (targetSummary && targetSummary.percentageUsed >= 80) {
        this.mailService.sendBudgetAlert(
          user.email,
          targetSummary.categoryName,
          targetSummary.budgetAmount,
          targetSummary.percentageUsed,
        );
      }
    }

    // B. Check Weekly Budget Alerts
    const weeklyBudgets = await this.budgetRepository.find({
      where: {
        user: { id: user.id },
        category: { id: categoryId },
        week,
        month,
        year,
      },
      relations: { category: true },
    });

    for (const budget of weeklyBudgets) {
      const summaries = await this.getWeeklyBudgetSummary(week, month, year, user);
      const targetSummary = summaries.find((s) => s.budgetId === budget.id);

      if (targetSummary && targetSummary.percentageUsed >= 80) {
        this.mailService.sendBudgetAlert(
          user.email,
          `${targetSummary.categoryName} (Week ${week})`,
          targetSummary.budgetAmount,
          targetSummary.percentageUsed,
        );
      }
    }
  }

  // 5. Update Budget
  async update(id: number, updateBudgetDto: UpdateBudgetDto, user: User): Promise<Budget> {
    const budget = await this.budgetRepository.findOne({
      where: { id: Number(id), user: { id: user.id } },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const { amount, ...rest } = updateBudgetDto;
    if (amount !== undefined) {
      budget.amountLimit = amount;
    }

    Object.assign(budget, rest);
    return await this.budgetRepository.save(budget);
  }

  // 6. Delete Budget
  async remove(id: number, user: User): Promise<{ message: string }> {
    const budget = await this.budgetRepository.findOne({
      where: { id: Number(id), user: { id: user.id } },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.budgetRepository.remove(budget);
    return {message:"budget removed successfully"};
  }
}