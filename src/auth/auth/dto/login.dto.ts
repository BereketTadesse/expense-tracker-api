import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsStrongPassword } from "class-validator";
export class LoginDto {
  @IsEmail({}, { message: 'Email is not valid' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}