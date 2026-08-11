import { IsNumber, IsEnum, IsString, IsOptional, IsUUID, IsPositive } from 'class-validator';

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

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