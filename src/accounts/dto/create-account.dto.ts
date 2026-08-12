import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { AccountType } from '../entities/accounts.entity';
import { Currency } from '../../common/enums/currency.enum';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsString()
  @IsOptional()
  senderHeader?: string;

  @IsString()
  @IsOptional()
  accountMask?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}