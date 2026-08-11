import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction } from './entities/transactions.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const { amount, type, note, accountId } = createTransactionDto;

    return await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(Account, { where: { id: accountId } });
      if (!account) {
        throw new NotFoundException(`Account with ID "${accountId}" not found`);
      }

      // Adjust account balance based on transaction type
      if (type.toUpperCase() === 'EXPENSE') {
        account.balance = Number(account.balance) - amount;
      } else if (type.toUpperCase() === 'INCOME') {
        account.balance = Number(account.balance) + amount;
      }

      await manager.save(account);

      const transaction = manager.create(Transaction, {
        amount,
        type,
        description: note,
        account,
      });

      return await manager.save(transaction);
    });
  }

  async findAll(): Promise<Transaction[]> {
    return await this.transactionRepository.find({
      relations: { account: true, category: true },
      order: { date: 'DESC' },
    });
  }
}