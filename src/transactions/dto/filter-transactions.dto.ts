// src/transactions/dto/filter-transactions.dto.ts
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../entities/transactions.entity';

export class FilterTransactionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // ⬇️ Scroll down: Fetch items OLDER than this cursor
  @IsOptional()
  @IsString()
  beforeCursor?: string;

  // ⬆️ Pull update: Fetch items NEWER than this cursor
  @IsOptional()
  @IsString()
  afterCursor?: string;

  // 🎯 Dynamic Filters
  @IsOptional()
  @IsEnum(TransactionType, { message: 'Type must be EXPENSE or INCOME' })
  type?: TransactionType;

  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string; // Keyword search for merchant name or description
}