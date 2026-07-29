import { Module } from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import { ConfigModule ,ConfigService} from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['src/.env', '.env'],
    }),

    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService:ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: String(configService.get<string>('DB_PASSWORD')),
    database: configService.get<string>('DB_NAME'),
    autoLoadEntities: true,
    synchronize: true,
  }), 
  inject:[ConfigService]
  }), 
  UsersModule, AccountsModule, CategoriesModule, TransactionsModule, BudgetsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
