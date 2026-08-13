import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from "../../users/entities/user.entity";
import { Category } from '../../categories/entities/category.entity';

@Entity('budgets')
@Unique(['user', 'category', 'week','month', 'year']) // Prevents duplicate budgets for same month
export class Budget {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amountLimit: number;

    @Column({ type: 'int' })
    week: number; // 1 - 52

    @Column({ type: 'int' })
    month: number; // 1 - 12

    @Column({ type: 'int' })
    year: number; // e.g., 2026

    @ManyToOne(() => User, (user) => user.budgets, { onDelete: 'CASCADE' })
    user: User;

    @ManyToOne(() => Category, (category) => category.budgets, { onDelete: 'CASCADE' })
    category: Category;
}