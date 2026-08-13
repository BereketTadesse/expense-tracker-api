// src/accounts/entities/account.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  OneToMany, 
  CreateDateColumn, 
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn 
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transactions.entity';
import { Currency } from '../../common/enums/currency.enum';

export enum AccountType {
  CHECKING = 'CHECKING',       // CBE, BOA, Dashen Bank accounts
  MOBILE_WALLET = 'MOBILE_WALLET', // Telebirr, CBE Birr
  CASH = 'CASH',               // Physical cash
  SAVINGS = 'SAVINGS',         // High-yield savings
  CREDIT = 'CREDIT',           // Overdrafts / Credit Cards
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. "CBE Primary", "Telebirr Wallet"

  @Column({ type: 'enum', enum: AccountType, default: AccountType.CHECKING })
  type: AccountType;

  // 📲 SMS Header from Bank (e.g., "CBE", "127", "telebirr", "Abyssinia", "DashenBank")
  @Column({ type: 'varchar', nullable: true })
  senderHeader: string | null;

  // 📲 Account Mask in SMS (e.g., "3866" or "1********3866")
  @Column({ type: 'varchar', nullable: true })
  accountMask: string | null;

  // ⚠️ Stored as decimal to prevent floating point inaccuracies
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0.00 })
  balance: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.ETB })
  currency: Currency;

  // 🛡️ Optimistic Locking: prevents two concurrent SMS from corrupting balance
  @VersionColumn()
  version: number;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions: Transaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null; // Soft delete
}