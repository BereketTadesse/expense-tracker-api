import { Injectable,BadRequestException,NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Category, CategoryType } from '../../categories/entities/category.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository:Repository<User>,
        private readonly jwtService:JwtService,
        @InjectRepository(Category)
        private readonly categoryRepository:Repository<Category>
    ){}

async register(registerDto:RegisterDto){
    const {email,password,fullName}=registerDto;
    const existingUser =await this.userRepository.findOne({where:{email}})
    if(existingUser){
        throw new BadRequestException("User already exists")
    }
    const hashedPassword =await bcrypt.hash(password,10);
    const user =this.userRepository.create({
        email,
        password:hashedPassword,
        name:fullName
    })
    await this.userRepository.save(user);
    await this.seedDefaultCategories(user);
    return {message:"User registered successfully",user:user}
}
async login(loginDto:LoginDto){
    const {email,password}=loginDto;
    const user =await this.userRepository.findOne({where:{email}})
    if(!user){
        throw new NotFoundException("User not found")
    }
    const isPasswordValid =await bcrypt.compare(password,user.password);
    if(!isPasswordValid){
        throw new BadRequestException("Invalid password")
    }
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return {message:"User logged in successfully",user:user,token:token}
}

async getProfile(user: User) {
  return this.userRepository.findOne({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

private async seedDefaultCategories(user: User): Promise<void> {
    const defaults = [
      { name: 'Groceries', type: CategoryType.EXPENSE },
      { name: 'Rent & Housing', type: CategoryType.EXPENSE },
      { name: 'Utilities & Bills', type: CategoryType.EXPENSE },
      { name: 'Dining Out', type: CategoryType.EXPENSE },
      { name: 'Entertainment', type: CategoryType.EXPENSE },
      { name: 'Salary', type: CategoryType.INCOME },
      { name: 'Side Income', type: CategoryType.INCOME },
    ];

    const categoryEntities = defaults.map((item) =>
      this.categoryRepository.create({
        name: item.name,
        type: item.type,
        user,
      }),
    );

    await this.categoryRepository.save(categoryEntities);
  }
}

