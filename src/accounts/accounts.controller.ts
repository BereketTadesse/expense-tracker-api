import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountsService } from './accounts.service';
@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountservice:AccountsService){}
    @Post()
    create(@Body()createAccountDto:CreateAccountDto){
        return this.accountservice.create(createAccountDto);
    }
    @Get()
    findAll(){
        return this.accountservice.findAll();
    }
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.accountservice.findOne(id);
    }
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
        return this.accountservice.update(id, updateAccountDto);
    }
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.accountservice.remove(id);
    }
}
