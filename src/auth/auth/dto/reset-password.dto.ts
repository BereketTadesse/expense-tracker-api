import { IsString,IsStrongPassword,IsNotEmpty} from "class-validator";

export class ResetPasswordDto {
    @IsString()
    @IsStrongPassword()
    @IsNotEmpty({message: "Password is required"})
    password:string;
    @IsString()
    @IsStrongPassword()
    @IsNotEmpty({message: "Password is required"})
    confirmPassword:string;
    @IsString()
    @IsNotEmpty({message: "Token is required"})
    token:string;
}