import{Entity,PrimaryGeneratedColumn,Column,CreateDateColumn,UpdateDateColumn,ManyToOne} from "typeorm";
import{User} from "../../users/entities/user.entity";
import{Account} from "../../accounts/entities/accounts.entity";
import{Category} from "../../categories/entities/category.entity";

@Entity()
export class Transaction{
    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    amount:number;
    @Column()
    type:string;
    @Column()
    description:string;
    @Column()
    date:Date;
    @CreateDateColumn()
    createdAt:Date;
    @UpdateDateColumn()
    updatedAt:Date;
    @ManyToOne(()=>User,(user)=>user.transactions)
    user:User;
    @ManyToOne(()=>Account,(account)=>account.transactions)
    account:Account;
    @ManyToOne(()=>Category,(category)=>category.transactions)
    category:Category;

}