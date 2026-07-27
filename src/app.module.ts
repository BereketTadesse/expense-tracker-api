import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';

@Module({
  imports: [UsersModule, AccountsModule, CategoriesModule, TransactionsModule, BudgetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
