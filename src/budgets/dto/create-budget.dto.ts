import { IsNotEmpty, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;

  @IsNumber({}, { message: 'Budget limit amount must be a number' })
  @Min(1, { message: 'Budget limit must be greater than zero' })
  amount: number;

  @IsNumber({}, { message: 'Week must be a number between 1 and 52' })
  @Min(1)
  @Max(52)
  week: number;
  
  @IsNumber({}, { message: 'Month must be a number between 1 and 12' })
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber({}, { message: 'Year must be a valid four-digit year' })
  @Min(2018)
  @Max(2100)
  year: number;
}