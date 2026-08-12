import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@Body() createBudgetDto: CreateBudgetDto, @CurrentUser() user: User) {
    return this.budgetsService.create(createBudgetDto, user);
  }

  @Get('summary')
  getSummary(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('week') week?: string,
    @CurrentUser() user?: User,
  ) {
    if (week) {
      return this.budgetsService.getWeeklyBudgetSummary(parseInt(week, 10), month, year, user!);
    }
    return this.budgetsService.getMonthlyBudgetSummary(month, year, user!);
  }

  @Get('summary/weekly')
  getWeeklySummary(
    @Query('week', ParseIntPipe) week: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.getWeeklyBudgetSummary(week, month, year, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBudgetDto: UpdateBudgetDto,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.update(id, updateBudgetDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.budgetsService.remove(id, user);
  }
}
