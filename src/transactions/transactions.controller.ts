import { Controller, Post, Body, Get } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Transaction } from './entities/transactions.entity';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionService: TransactionsService){}

    @Post()
    async create(@Body() createTransactionDto:CreateTransactionDto):Promise<Transaction>{
        return await this.transactionService.create(createTransactionDto);
    }
    @Get()
    async findAll():Promise<Transaction[]>{
        return await this.transactionService.findAll();
    }
    
}
