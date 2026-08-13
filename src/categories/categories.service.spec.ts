import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category, CategoryType } from './entities/category.entity';
import { User } from '../users/entities/user.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const mockUser = { id: 1 } as User;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if category already exists', async () => {
      repository.findOne.mockResolvedValue({ id: 'cat-1', name: 'Groceries' });

      await expect(
        service.create({ name: 'Groceries', type: CategoryType.EXPENSE }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and save custom category', async () => {
      repository.findOne.mockResolvedValue(null);
      const newCategory = { name: 'Gym', type: CategoryType.EXPENSE, isDefault: false, user: mockUser };
      repository.create.mockReturnValue(newCategory);
      repository.save.mockResolvedValue({ id: 'cat-2', ...newCategory });

      const result = await service.create({ name: 'Gym', type: CategoryType.EXPENSE }, mockUser);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Gym',
        type: CategoryType.EXPENSE,
        isDefault: false,
        user: mockUser,
      });
      expect(result).toEqual({ id: 'cat-2', ...newCategory });
    });
  });

  describe('findAll', () => {
    it('should return user and default categories', async () => {
      const categories = [{ id: 'cat-1', name: 'Groceries' }];
      repository.find.mockResolvedValue(categories);

      const result = await service.findAll(mockUser);
      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if category not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should return category when found', async () => {
      const category = { id: 'cat-1', name: 'Groceries' };
      repository.findOne.mockResolvedValue(category);

      const result = await service.findOne('cat-1', mockUser);
      expect(result).toEqual(category);
    });
  });

  describe('update', () => {
    it('should throw BadRequestException when editing default category', async () => {
      repository.findOne.mockResolvedValue({ id: 'cat-default', isDefault: true });

      await expect(
        service.update('cat-default', { name: 'Updated' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update custom category', async () => {
      const customCategory = { id: 'cat-custom', name: 'Old', isDefault: false };
      repository.findOne.mockResolvedValue(customCategory);
      repository.save.mockImplementation((c) => Promise.resolve(c));

      const result = await service.update('cat-custom', { name: 'New Name' }, mockUser);
      expect(result.name).toBe('New Name');
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException when removing default category', async () => {
      repository.findOne.mockResolvedValue({ id: 'cat-default', isDefault: true });

      await expect(service.remove('cat-default', mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should remove custom category', async () => {
      const customCategory = { id: 'cat-custom', isDefault: false };
      repository.findOne.mockResolvedValue(customCategory);
      repository.remove.mockResolvedValue(customCategory);

      const result = await service.remove('cat-custom', mockUser);
      expect(result).toEqual({ message: 'Category deleted successfully' });
    });
  });
});
