import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { MailService } from '../../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let categoryRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let mailService: {
    sendWelcomeEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    categoryRepository = {
      create: jest.fn((item) => item),
      save: jest.fn().mockResolvedValue([]),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    mailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw BadRequestException if user email exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await expect(
        service.register({ email: 'test@example.com', password: 'password123', fullName: 'Bereket' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user, seed default categories, and send welcome email', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockCreatedUser = { id: 1, email: 'test@example.com', name: 'Bereket' };
      userRepository.create.mockReturnValue(mockCreatedUser);
      userRepository.save.mockResolvedValue(mockCreatedUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Bereket',
      });

      expect(userRepository.create).toHaveBeenCalled();
      expect(categoryRepository.save).toHaveBeenCalled();
      expect(mailService.sendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'Bereket');
      expect(result.message).toBe('User registered successfully');
    });
  });

  describe('login', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'password' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      userRepository.findOne.mockResolvedValue({ id: 1, email: 'test@example.com', password: hashedPassword });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongPassword' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate JWT token on successful login', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      const user = { id: 1, email: 'test@example.com', password: hashedPassword };
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.login({ email: 'test@example.com', password: 'correctPassword' });

      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 1, email: 'test@example.com' });
      expect(result.token).toBe('mock-jwt-token');
    });
  });

  describe('logout', () => {
    it('should return success message on logout', async () => {
      const result = await service.logout();
      expect(result).toEqual({ message: 'User logged out successfully' });
    });
  });

  describe('forgetpassword', () => {
    it('should throw NotFoundException if user email does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.forgetpassword({ email: 'missing@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set reset token and send reset email', async () => {
      const user = { id: 1, email: 'user@example.com' };
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await service.forgetpassword({ email: 'user@example.com' });

      expect(userRepository.save).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
      expect(result.message).toBe('Reset password email sent successfully');
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if passwords do not match', async () => {
      await expect(
        service.resetPassword({ password: 'p1', confirmPassword: 'p2', token: 'token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid token', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ password: 'newpass', confirmPassword: 'newpass', token: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredDate = new Date(Date.now() - 10000);
      userRepository.findOne.mockResolvedValue({
        id: 1,
        resetPasswordExpires: expiredDate,
      });

      await expect(
        service.resetPassword({ password: 'newpass', confirmPassword: 'newpass', token: 'expired-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and clear reset token on success', async () => {
      const futureDate = new Date(Date.now() + 60000);
      const user = {
        id: 1,
        resetPasswordToken: 'valid-token',
        resetPasswordExpires: futureDate,
      };
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.resetPassword({
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
        token: 'valid-token',
      });

      expect(userRepository.save).toHaveBeenCalled();
      expect(result.message).toBe('Password reset successfully');
    });
  });
});
