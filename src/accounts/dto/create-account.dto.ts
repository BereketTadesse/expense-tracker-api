import { IsString, IsEnum, IsNumber, IsOptional, Min, IsEmpty } from "class-validator";

export class CreateAccountDto {
    @IsString()
    name: string;

    @IsString()
    type: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    balance: number;

    @IsString()
    currency: string;
}