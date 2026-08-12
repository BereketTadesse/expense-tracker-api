
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transactions.entity';
import { Budget } from '../../budgets/entities/budget.entity';

export enum CategoryType {
    EXPENSE = 'EXPENSE',
    INCOME = 'INCOME',
}

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ type: 'enum', enum: CategoryType, default: CategoryType.EXPENSE })
    type: CategoryType;

    @Column({ type: 'boolean', default: false })
    isDefault: boolean;
  
    @ManyToOne(() => User, (user) => user.categories, { onDelete: 'CASCADE' })
    user: User;

    @OneToMany(() => Transaction, (transaction) => transaction.category)
    transactions: Transaction[];

    @OneToMany(() => Budget, (budget) => budget.category)
    budgets: Budget[];
}


