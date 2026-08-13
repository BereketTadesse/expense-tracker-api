import { IsNumber, IsEnum, IsString, IsOptional, IsUUID, IsPositive } from 'class-validator';
import { TransactionType } from '../entities/transactions.entity';

export { TransactionType };

export class CreateTransactionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType; // 'EXPENSE' or 'INCOME'

  @IsString()
  @IsOptional()
  note?: string;

  @IsUUID()
  accountId: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;
}