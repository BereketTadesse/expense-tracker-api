import { IsString, IsNotEmpty } from 'class-validator';

export class FindAccountBySmsDto {
  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  smsBody: string;
}
