import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class TransferDto {
  @IsUUID('4', { message: 'Source account ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source account ID is required' })
  fromAccountId: string;

  @IsUUID('4', { message: 'Destination account ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Destination account ID is required' })
  toAccountId: string;

  @IsNumber({}, { message: 'Transfer amount must be a number' })
  @Min(0.01, { message: 'Transfer amount must be greater than zero' })
  amount: number;
}