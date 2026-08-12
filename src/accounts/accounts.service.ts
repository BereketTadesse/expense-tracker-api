// src/accounts/accounts.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Account } from './entities/accounts.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { User } from '../users/entities/user.entity';
import { TransferDto } from './dto/transfer.dto';
import { DataSource } from 'typeorm';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createAccountDto: CreateAccountDto, user: User): Promise<Account> {
    const account = this.accountRepository.create({
      ...createAccountDto,
      user,
    });
    return await this.accountRepository.save(account);
  }

  async findAll(user: User): Promise<Account[]> {
    return await this.accountRepository.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, user: { id: user.id } },
    });
    if (!account) {
      throw new NotFoundException(`Account not found or access denied`);
    }
    return account;
  }

  // 🔍 MATCH SMS TO ACCOUNT: Finds user's account by matching SMS Header & Mask
  async findAccountBySms(sender: string, smsBody: string, user: User): Promise<Account | null> {
    const accounts = await this.findAll(user);

    for (const account of accounts) {
      if (account.senderHeader && sender.toLowerCase().includes(account.senderHeader.toLowerCase())) {
        if (account.accountMask) {
          if (smsBody.toLowerCase().includes(account.accountMask.toLowerCase())) {
            return account;
          }
        } else {
          return account;
        }
      }
    }
    return null;
  }

  // 🔒 ATOMIC BALANCE MUTATION: Executed within the Transaction Webhook pipeline
  async updateBalance(
    accountId: string,
    amount: number,
    type: 'EXPENSE' | 'INCOME',
    manager?: EntityManager,
  ): Promise<Account> {
    const entityManager = manager || this.accountRepository.manager;
    // Row lock ensures two concurrent requests wait in line
    const account = await entityManager.findOne(Account, {
      where: { id: accountId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!account) {
      throw new NotFoundException('Target account for SMS transaction not found');
    }

    const currentBalance = Number(account.balance);
    const changeAmount = Number(amount);

    if (type === 'EXPENSE') {
      account.balance = currentBalance - changeAmount;
    } else if (type === 'INCOME') {
      account.balance = currentBalance + changeAmount;
    }

    return await entityManager.save(account);
  }

  async update(id: string, updateAccountDto: UpdateAccountDto, user: User): Promise<Account> {
    const account = await this.findOne(id, user);
    Object.assign(account, updateAccountDto);
    return await this.accountRepository.save(account);
  }

  async remove(id: string, user: User): Promise<void> {
    const account = await this.findOne(id, user);
    await this.accountRepository.softRemove(account);
  }
  // 1. Account-to-Account Transfer Logic
async transfer(transferDto: TransferDto, user: User) {
  const { fromAccountId, toAccountId, amount } = transferDto;

  if (fromAccountId === toAccountId) {
    throw new BadRequestException('Source and destination accounts cannot be the same');
  }

  return await this.dataSource.transaction(async (manager) => {
    // Fetch both accounts belonging to the authenticated user
    const sourceAccount = await manager.findOne(Account, {
      where: { id: fromAccountId, user: { id: user.id } },
      lock: { mode: 'pessimistic_write' },
    });

    const destAccount = await manager.findOne(Account, {
      where: { id: toAccountId, user: { id: user.id } },
      lock: { mode: 'pessimistic_write' },
    });

    if (!sourceAccount || !destAccount) {
      throw new BadRequestException('Source or destination account not found or unauthorized');
    }

    if (Number(sourceAccount.balance) < amount) {
      throw new BadRequestException('Insufficient balance in source account');
    }

    // Mutate balances
    sourceAccount.balance = Number(sourceAccount.balance) - Number(amount);
    destAccount.balance = Number(destAccount.balance) + Number(amount);

    await manager.save([sourceAccount, destAccount]);

    return {
      message: `Successfully transferred ${amount} ${sourceAccount.currency} from ${sourceAccount.name} to ${destAccount.name}`,
      sourceAccount: { id: sourceAccount.id, name: sourceAccount.name, newBalance: sourceAccount.balance },
      destinationAccount: { id: destAccount.id, name: destAccount.name, newBalance: destAccount.balance },
    };
  });
}

// 2. Net Worth & Financial Overview Summary
async getSummary(user: User) {
  const accounts = await this.findAll(user);

  let totalNetWorth = 0;
  const breakdownByType: Record<string, number> = {};

  for (const account of accounts) {
    const bal = Number(account.balance);
    totalNetWorth += bal;

    if (!breakdownByType[account.type]) {
      breakdownByType[account.type] = 0;
    }
    breakdownByType[account.type] += bal;
  }

  return {
    totalNetWorth,
    currency: 'ETB',
    accountCount: accounts.length,
    breakdownByType,
    accounts,
  };
}
}