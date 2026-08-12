import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { FindAccountBySmsDto } from './dto/find-account-by-sms.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { TransferDto } from './dto/transfer.dto';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Body() createAccountDto: CreateAccountDto, @CurrentUser() user: User) {
    return this.accountsService.create(createAccountDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.accountsService.findAll(user);
  }

  @Get('summary') // 📊 GET /api/accounts/summary
  getSummary(@CurrentUser() user: User) {
    return this.accountsService.getSummary(user);
  }

  @Post('transfer') // 💸 POST /api/accounts/transfer
  transfer(@Body() transferDto: TransferDto, @CurrentUser() user: User) {
    return this.accountsService.transfer(transferDto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.accountsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @CurrentUser() user: User,
  ) {
    return this.accountsService.update(id, updateAccountDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.accountsService.remove(id, user);
  }
}
