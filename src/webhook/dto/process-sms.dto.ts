
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ProcessSmsDto {
  @IsString()
  @IsNotEmpty({ message: 'SMS sender is required (e.g., CBE, 127, Abyssinia)' })
  sender: string;

  @IsString()
  @IsNotEmpty({ message: 'SMS message body is required' })
  message: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}