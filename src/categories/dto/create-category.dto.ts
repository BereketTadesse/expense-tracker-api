import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '../entities/category.entity';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  name: string;

  @IsEnum(CategoryType, { message: 'Type must be EXPENSE or INCOME' })
  @IsOptional()
  type?: CategoryType;
}