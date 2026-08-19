import {Entity,PrimaryGeneratedColumn,Column,CreateDateColumn,UpdateDateColumn,OneToMany, BeforeInsert} from "typeorm";
import { v4 as uuidv4 } from 'uuid';
import {Account} from "../../accounts/entities/accounts.entity";
import{Category} from "../../categories/entities/category.entity";
import {Transaction} from "../../transactions/entities/transactions.entity";
import{Budget} from "../../budgets/entities/budget.entity";

@Entity('user')
export class User{

    @PrimaryGeneratedColumn()
    id:number;
    @Column({unique:true})
    email:string;
    @Column()
    password:string;
    @Column()
    name:string;
    @Column({ type: 'varchar', nullable: true })
    resetPasswordToken: string | null;

    @Column({ type: 'varchar', unique: true, nullable: true })
    webhookToken: string | null;

    @BeforeInsert()
    generateWebhookToken() {
      if (!this.webhookToken) {
        this.webhookToken = uuidv4();
      }
    }
    @Column({ type: 'timestamp', nullable: true })
    resetPasswordExpires: Date | null;
    @CreateDateColumn()
    createdAt:Date;
    @UpdateDateColumn()
    updatedAt:Date;
    @OneToMany(()=>Account,(account)=>account.user)
    accounts:Account[];
    @OneToMany(()=>Category,(category)=>category.user)
    categories:Category[];
    @OneToMany(()=>Transaction,(transaction)=>transaction.user)
    transactions:Transaction[];
    @OneToMany(()=>Budget,(budget)=>budget.user)
    budgets:Budget[];

}