import { Injectable,BadRequestException,NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { Category, CategoryType } from '../../categories/entities/category.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
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

async logout() {
  return { message: 'User logged out successfully' };
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

async getWebhookToken(user: User) {
  const found = await this.userRepository.findOne({ where: { id: user.id } });
  if (!found) throw new NotFoundException('User not found');

  // Auto-generate token if user was created before this feature was added
  if (!found.webhookToken) {
    found.webhookToken = uuidv4();
    await this.userRepository.save(found);
  }

  const webhookUrl = `YOUR_API_BASE_URL/api/webhook/sms?token=${found.webhookToken}`;
  return {
    webhookToken: found.webhookToken,
    webhookUrl,
    instructions: 'Copy the webhookUrl above and paste it into the Incoming SMS App URL field on your phone.',
  };
}

async regenerateWebhookToken(user: User) {
  const found = await this.userRepository.findOne({ where: { id: user.id } });
  if (!found) throw new NotFoundException('User not found');
  found.webhookToken = uuidv4();
  await this.userRepository.save(found);
  return {
    message: 'Webhook token regenerated successfully. Update your SMS Forwarder app URL.',
    webhookToken: found.webhookToken,
    webhookUrl: `YOUR_API_BASE_URL/api/webhook/sms?token=${found.webhookToken}`,
  };
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

