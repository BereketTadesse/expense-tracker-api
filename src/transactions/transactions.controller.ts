import { Controller, Post, Body, Get, Query, UseGuards, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, ParseIntPipe } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction} from './entities/transactions.entity';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { User } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';


@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: User,
  ): Promise<Transaction> {
    return await this.transactionService.create(createTransactionDto, user);
  }

  @Get()
  async findAllPaginated(
    @Query() filterDto: FilterTransactionsDto,
    @CurrentUser() user: User,
  ) {
    return await this.transactionService.findAllPaginated(filterDto, user);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.transactionService.remove(id, user);
  }
  // Add inside TransactionsController in src/transactions/transactions.controller.ts

@Get('analytics/overview') // 📊 GET /api/transactions/analytics/overview?month=8&year=2026
getMonthlyOverview(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @CurrentUser() user: User,
) {
  return this.transactionService.getMonthlyOverview(month, year, user);
}

@Get('analytics/category-breakdown') // 📈 GET /api/transactions/analytics/category-breakdown?month=8&year=2026
getCategoryBreakdown(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @CurrentUser() user: User,
) {
  return this.transactionService.getCategoryBreakdown(month, year, user);
}

@Get('analytics/trends') // 📉 GET /api/transactions/analytics/trends?year=2026
getAnnualTrends(
  @Query('year', ParseIntPipe) year: number,
  @CurrentUser() user: User,
) {
  return this.transactionService.getAnnualTrends(year, user);
}
// Add inside TransactionsController in src/transactions/transactions.controller.ts

// 📈 GET /api/transactions/analytics/mom?month=8&year=2026
@Get('analytics/mom')
getMoMComparison(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @CurrentUser() user: User,
) {
  return this.transactionService.getMoMComparison(month, year, user);
}

// 🏆 GET /api/transactions/analytics/top-merchants?month=8&year=2026&limit=5
@Get('analytics/top-merchants')
getTopMerchants(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @Query('limit') limit: number = 5,
  @CurrentUser() user: User,
) {
  return this.transactionService.getTopMerchants(month, year, limit, user);
}

// 📅 GET /api/transactions/analytics/daily-stats?month=8&year=2026
@Get('analytics/daily-stats')
getDailySpendingStats(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @CurrentUser() user: User,
) {
  return this.transactionService.getDailySpendingStats(month, year, user);
}
}
