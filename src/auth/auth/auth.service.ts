import { Injectable,BadRequestException,NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Category, CategoryType } from '../../categories/entities/category.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';
import {ResetPasswordDto} from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import {MailService} from '../../mail/mail.service';


@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository:Repository<User>,
        private readonly jwtService:JwtService,
        @InjectRepository(Category)
        private readonly categoryRepository:Repository<Category>,
        private readonly mailService:MailService,
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
    await this.mailService.sendWelcomeEmail(email,fullName);
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

async forgetpassword(forgotPasswordDto:ForgotPasswordDto){
    const{email} = forgotPasswordDto;
    const user=await this.userRepository.findOne({where:{email}})
    if(!user){
      throw new NotFoundException("User not found")
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = expireAt;
    await this.userRepository.save(user);
    await this.mailService.sendPasswordResetEmail(email,resetToken);
    return {message:"Reset password email sent successfully"}
}

async resetPassword(resetPasswordDto:ResetPasswordDto){
    const {password,confirmPassword,token} = resetPasswordDto;
    if(password !== confirmPassword){
        throw new BadRequestException("Passwords do not match")
    }
    const user = await this.userRepository.findOne({where:{resetPasswordToken: token}})
    if(!user){
        throw new NotFoundException("Invalid or expired reset token")
    }
    if(user.resetPasswordExpires && user.resetPasswordExpires < new Date()){
        throw new BadRequestException("Reset token has expired")
    }
    const hashedPassword =await bcrypt.hash(password,10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.userRepository.save(user);
    return {message:"Password reset successfully"}
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

