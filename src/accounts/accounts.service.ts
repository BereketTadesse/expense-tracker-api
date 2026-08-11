import { Injectable,NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/accounts.entity';
import { Repository } from 'typeorm';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';


@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    const account = this.accountRepository.create(createAccountDto);
    return await this.accountRepository.save(account);
  }

  async findAll(): Promise<Account[]> {
    return await this.accountRepository.find();
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accountRepository.findOneBy({ id });
    if (!account) {
      throw new NotFoundException(`Account with ID "${id}" not found`);
    }
    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto): Promise<Account> {
    const account = await this.findOne(id);
    Object.assign(account, updateAccountDto);
    return await this.accountRepository.save(account);
  }

  async remove(id: string): Promise<void> {
    const account = await this.findOne(id);
    await this.accountRepository.remove(account);
  }
}
