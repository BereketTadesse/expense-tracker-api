import{Entity,PrimaryGeneratedColumn,Column,CreateDateColumn,UpdateDateColumn,ManyToOne,OneToMany} from "typeorm";
import {User} from "../../users/entities/user.entity";
import {Transaction} from "../../transactions/entities/transactions.entity";

@Entity()
export class Account{
    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    name:string;
    @Column()
    type:string;
    @Column()
    balance:number;
    @Column()
    currency:string;
    @CreateDateColumn()
    createdAt:Date;
    @UpdateDateColumn()
    updatedAt:Date;
    @ManyToOne(()=>User,(user)=>user.accounts)
    user:User;
    @OneToMany(()=>Transaction,(transaction)=>transaction.account)
    transactions:Transaction[];
}