import { IsNumber, IsEnum, IsNotEmpty, Min } from 'class-validator';
import { TransactionType } from '../../transactions/entities/transactions.entity';

export { TransactionType };

export class UpdateBalanceDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;
}
