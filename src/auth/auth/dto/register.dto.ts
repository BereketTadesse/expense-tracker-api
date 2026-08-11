import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsStrongPassword,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email is not valid' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsStrongPassword(
    { minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 },
    { message: 'Password must contain at least one lowercase, uppercase, number and symbol' },
  )
  @MinLength(6,{message:'Password must be at least 6 characters long'})
  @MaxLength(20,{message:'Password must be at most 20 characters long'})
  @IsNotEmpty({message:'Password is required'})
  password: string;
}