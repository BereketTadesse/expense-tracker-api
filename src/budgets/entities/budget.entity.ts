import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from "../../users/entities/user.entity";
import { Category } from '../../categories/entities/category.entity';

@Entity()
@Unique(['user', 'category', 'month', 'year']) // Prevents duplicate budgets for same month
export class Budget {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amountLimit: number;

    @Column({ type: 'int' })
    month: number; // 1 - 12

    @Column({ type: 'int' })
    year: number; // e.g., 2026

    @ManyToOne(() => User, (user) => user.budgets, { onDelete: 'CASCADE' })
    user: User;

    @ManyToOne(() => Category, (category) => category.budgets, { onDelete: 'CASCADE' })
    category: Category;
}