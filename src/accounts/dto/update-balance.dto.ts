import { IsNumber, IsEnum, IsNotEmpty, Min } from 'class-validator';

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export class UpdateBalanceDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;
}
