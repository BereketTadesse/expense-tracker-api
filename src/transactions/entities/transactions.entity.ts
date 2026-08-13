import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Account } from '../../accounts/entities/accounts.entity';
import { Category } from '../../categories/entities/category.entity';
export enum TransactionType { EXPENSE = 'EXPENSE', INCOME = 'INCOME' }
  
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  referenceId?: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar' })
  type: string; // e.g. "EXPENSE" or "INCOME"

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Account, (account) => account.transactions, { onDelete: 'CASCADE' })
  account: Account;

  @ManyToOne(() => Category, (category) => category.transactions, { onDelete: 'SET NULL', nullable: true })
  category: Category;

  @CreateDateColumn()
  createdAt: Date;
}