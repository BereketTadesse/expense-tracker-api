import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction ,TransactionType} from './entities/transactions.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountsService } from '../accounts/accounts.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import {User} from '../users/entities/user.entity';
export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
  ) {}

  private encodeCursor(date: Date, id: string):string{
    const payload = JSON.stringify({date: date.toISOString(), id})
    return Buffer.from(payload).toString('base64');
  }

  private decodeCursor(cursor: string):{date:Date ; id:string}{
    try{const payload = Buffer.from(cursor, 'base64').toString('utf-8');
    const {date,id} = JSON.parse(payload);
    return {date: new Date(date), id};
  }catch (error) {
    throw new BadRequestException('Invalid cursor');
  }
}

  async create(createTransactionDto: CreateTransactionDto, user: User) {
    const { amount, type, note, accountId } = createTransactionDto;

    return await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(Account, { where: { id: accountId } });
      if (!account) {
        throw new NotFoundException(`Account with ID "${accountId}" not found`);
      }

      // Adjust account balance based on transaction type
      if (type.toUpperCase() === 'EXPENSE') {
        account.balance = Number(account.balance) - amount;
      } else if (type.toUpperCase() === 'INCOME') {
        account.balance = Number(account.balance) + amount;
      }

      await manager.save(account);

      const transaction = manager.create(Transaction, {
        amount,
        type,
        description: note,
        account,
        user,
      });

      return await manager.save(transaction);
    });
  }

  async findAllPaginated(
    filterDto: FilterTransactionsDto,
    user: User,
  ): Promise<CursorPaginatedResponse<Transaction>> {
    const {
      limit = 10,
      beforeCursor,
      afterCursor,
      type,
      accountId,
      categoryId,
      startDate,
      endDate,
      search,
    } = filterDto;

    // 1. Initialize QueryBuilder isolated by authenticated User
    const qb = this.transactionRepository
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.account', 'account')
      .leftJoinAndSelect('txn.category', 'category')
      .where('txn.user = :userId', { userId: user.id });

    // 2. Apply Optional Filters dynamically
    if (type) {
      qb.andWhere('txn.type = :type', { type });
    }

    if (accountId) {
      qb.andWhere('txn.account = :accountId', { accountId });
    }

    if (categoryId) {
      qb.andWhere('txn.category = :categoryId', { categoryId });
    }

    if (startDate && endDate) {
      qb.andWhere('txn.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('txn.date >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('txn.date <= :endDate', { endDate });
    }

    if (search) {
      qb.andWhere('LOWER(txn.description) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    // 3. Apply Cursor Logic for constant-time O(1) performance
    if (beforeCursor) {
      // Fetch items OLDER than beforeCursor (scrolling down)
      const { date, id } = this.decodeCursor(beforeCursor);
      qb.andWhere('(txn.date < :date OR (txn.date = :date AND txn.id < :id))', {
        date,
        id,
      });
    } else if (afterCursor) {
      // Fetch items NEWER than afterCursor (pulling updates)
      const { date, id } = this.decodeCursor(afterCursor);
      qb.andWhere('(txn.date > :date OR (txn.date = :date AND txn.id > :id))', {
        date,
        id,
      });
    }

    // 4. Order and Limit + 1 (to check if more items exist)
    qb.orderBy('txn.date', 'DESC')
      .addOrderBy('txn.id', 'DESC')
      .take(limit + 1);

    const items = await qb.getMany();

    // 5. Determine if another page exists
    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Remove the extra (+1) item used for detection
    }

    // 6. Generate Next and Previous cursors
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    const nextCursor = lastItem ? this.encodeCursor(lastItem.date, lastItem.id) : null;
    const prevCursor = firstItem ? this.encodeCursor(firstItem.date, firstItem.id) : null;

    return {
      data: items,
      meta: {
        limit,
        hasMore,
        nextCursor: hasMore ? nextCursor : null,
        prevCursor,
      },
    };
  }

  async remove(id: string, user: User) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Find transaction belonging to authenticated user
      const transaction = await manager.findOne(Transaction, {
        where: { id, user: { id: user.id } },
        relations: { account: true },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found or access denied');
      }

      const { account, amount, type } = transaction;

      // 2. Determine the opposite balance operation (Reversal)
      // EXPENSE deletion ➔ INCOME (+amount)
      // INCOME deletion  ➔ EXPENSE (-amount)
      const reversalType = type === TransactionType.EXPENSE ? 'INCOME' : 'EXPENSE';

      // 3. Update account balance atomically with pessimistic lock
      const updatedAccount = await this.accountsService.updateBalance(
        account.id,
        amount,
        reversalType,
        manager,
      );

      // 4. Remove the transaction record from the database
      await manager.remove(Transaction, transaction);

      return {
        success: true,
        message: `Transaction deleted successfully. Balance reversed on '${updatedAccount.name}'.`,
        data: {
          deletedTransactionId: id,
          accountName: updatedAccount.name,
          reversedAmount: amount,
          reversalType,
          newAccountBalance: updatedAccount.balance,
        },
      };
    });
  }

  // Add inside TransactionsService in src/transactions/transactions.service.ts

// 1. Monthly Cash Flow Overview (Income, Expense, Net Savings, Savings Rate)
async getMonthlyOverview(month: number, year: number, user: User) {
  const result = await this.transactionRepository
    .createQueryBuilder('txn')
    .select([
      `SUM(CASE WHEN txn.type = 'INCOME' THEN txn.amount ELSE 0 END) AS "totalIncome"`,
      `SUM(CASE WHEN txn.type = 'EXPENSE' THEN txn.amount ELSE 0 END) AS "totalExpense"`,
    ])
    .where('txn.userId = :userId', { userId: user.id })
    .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
    .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
    .getRawOne();

  const totalIncome = Number(result?.totalIncome) || 0;
  const totalExpense = Number(result?.totalExpense) || 0;
  const netSavings = totalIncome - totalExpense;
  const savingsRatePercentage = totalIncome > 0 
    ? Number(((netSavings / totalIncome) * 100).toFixed(1)) 
    : 0;

  return {
    month,
    year,
    currency: 'ETB',
    totalIncome,
    totalExpense,
    netSavings,
    savingsRatePercentage,
  };
}

// 2. Category Spending Distribution (Pie Chart)
async getCategoryBreakdown(month: number, year: number, user: User) {
  const rawData = await this.transactionRepository
    .createQueryBuilder('txn')
    .select('category.name', 'categoryName')
    .addSelect('SUM(txn.amount)', 'totalSpent')
    .leftJoin('txn.category', 'category')
    .where('txn.userId = :userId', { userId: user.id })
    .andWhere('txn.type = :type', { type: TransactionType.EXPENSE })
    .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
    .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
    .groupBy('category.name')
    .orderBy('"totalSpent"', 'DESC')
    .getRawMany();

  const overallExpense = rawData.reduce((acc, curr) => acc + Number(curr.totalSpent), 0);

  return rawData.map((item) => {
    const totalSpent = Number(item.totalSpent);
    const percentage = overallExpense > 0 
      ? Number(((totalSpent / overallExpense) * 100).toFixed(1)) 
      : 0;

    return {
      categoryName: item.categoryName || 'Uncategorized',
      totalSpent,
      percentage,
    };
  });
}

// 3. Annual Monthly Trends (Bar Chart for 12 months)
async getAnnualTrends(year: number, user: User) {
  const rawData = await this.transactionRepository
    .createQueryBuilder('txn')
    .select('EXTRACT(MONTH FROM txn.date)', 'month')
    .addSelect(`SUM(CASE WHEN txn.type = 'INCOME' THEN txn.amount ELSE 0 END)`, 'totalIncome')
    .addSelect(`SUM(CASE WHEN txn.type = 'EXPENSE' THEN txn.amount ELSE 0 END)`, 'totalExpense')
    .where('txn.userId = :userId', { userId: user.id })
    .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
    .groupBy('EXTRACT(MONTH FROM txn.date)')
    .orderBy('month', 'ASC')
    .getRawMany();

  return rawData.map((row) => ({
    month: Number(row.month),
    totalIncome: Number(row.totalIncome) || 0,
    totalExpense: Number(row.totalExpense) || 0,
    netSavings: (Number(row.totalIncome) || 0) - (Number(row.totalExpense) || 0),
  }));
}

// Add inside TransactionsService in src/transactions/transactions.service.ts

// 1. Month-over-Month (MoM) Comparison Engine
async getMoMComparison(month: number, year: number, user: User) {
  // Determine previous month and year
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const currentMonthData = await this.getMonthlyOverview(month, year, user);
  const prevMonthData = await this.getMonthlyOverview(prevMonth, prevYear, user);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const expenseChangePercentage = calculateChange(
    currentMonthData.totalExpense,
    prevMonthData.totalExpense,
  );
  
  const incomeChangePercentage = calculateChange(
    currentMonthData.totalIncome,
    prevMonthData.totalIncome,
  );

  return {
    currentPeriod: { month, year },
    previousPeriod: { month: prevMonth, year: prevYear },
    currentExpense: currentMonthData.totalExpense,
    previousExpense: prevMonthData.totalExpense,
    expenseChangePercentage, // e.g. +12.5% or -8.2%
    currentIncome: currentMonthData.totalIncome,
    previousIncome: prevMonthData.totalIncome,
    incomeChangePercentage,
    status: expenseChangePercentage > 0 ? 'SPENDING_INCREASED' : 'SPENDING_DECREASED',
  };
}

// 2. Top Merchants / Spending Destinations (e.g., Kaldi's, Ethio Telecom, Rent)
async getTopMerchants(month: number, year: number, limit: number = 5, user: User) {
  const topMerchants = await this.transactionRepository
    .createQueryBuilder('txn')
    .select('LOWER(txn.description)', 'merchant')
    .addSelect('SUM(txn.amount)', 'totalSpent')
    .addSelect('COUNT(txn.id)', 'transactionCount')
    .where('txn.userId = :userId', { userId: user.id })
    .andWhere('txn.type = :type', { type: TransactionType.EXPENSE })
    .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
    .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
    .groupBy('LOWER(txn.description)')
    .orderBy('"totalSpent"', 'DESC')
    .limit(limit)
    .getRawMany();

  return topMerchants.map((item) => ({
    merchant: item.merchant,
    totalSpent: Number(item.totalSpent),
    transactionCount: Number(item.transactionCount),
  }));
}

// 3. Daily Spending Velocity & Average Daily Expense
async getDailySpendingStats(month: number, year: number, user: User) {
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyTotals = await this.transactionRepository
    .createQueryBuilder('txn')
    .select('EXTRACT(DAY FROM txn.date)', 'day')
    .addSelect('SUM(txn.amount)', 'dailySpent')
    .where('txn.userId = :userId', { userId: user.id })
    .andWhere('txn.type = :type', { type: TransactionType.EXPENSE })
    .andWhere('EXTRACT(MONTH FROM txn.date) = :month', { month })
    .andWhere('EXTRACT(YEAR FROM txn.date) = :year', { year })
    .groupBy('EXTRACT(DAY FROM txn.date)')
    .orderBy('day', 'ASC')
    .getRawMany();

  const totalExpense = dailyTotals.reduce((acc, curr) => acc + Number(curr.dailySpent), 0);
  const averageDailySpend = Number((totalExpense / daysInMonth).toFixed(2));

  let maxDailySpend = 0;
  let peakDay: number | null = null;

  for (const row of dailyTotals) {
    const spent = Number(row.dailySpent);
    if (spent > maxDailySpend) {
      maxDailySpend = spent;
      peakDay = Number(row.day);
    }
  }

  return {
    month,
    year,
    daysInMonth,
    totalExpense,
    averageDailySpend,
    maxDailySpend,
    peakDay,
    dailyBreakdown: dailyTotals.map((r) => ({
      day: Number(r.day),
      dailySpent: Number(r.dailySpent),
    })),
  };
}

}