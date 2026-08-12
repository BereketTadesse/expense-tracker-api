import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  // 1. Create Custom Category
  async create(createCategoryDto: CreateCategoryDto, user: User): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: { name: createCategoryDto.name, user: { id: user.id } },
    });

    if (existing) {
      throw new BadRequestException(`Category '${createCategoryDto.name}' already exists`);
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      isDefault: false,
      user,
    });

    return await this.categoryRepository.save(category);
  }

  // 2. Find All Categories for User (User-created + System Defaults)
  async findAll(user: User): Promise<Category[]> {
    return await this.categoryRepository.find({
      where: [{ user: { id: user.id } }, { isDefault: true }],
      order: { name: 'ASC' },
    });
  }

  // 3. Find One Category by ID
  async findOne(id: string, user: User): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: [
        { id, user: { id: user.id } },
        { id, isDefault: true },
      ],
    });

    if (!category) {
      throw new NotFoundException(`Category not found or unauthorized`);
    }

    return category;
  }

  // 4. Update Custom Category
  async update(id: string, updateCategoryDto: UpdateCategoryDto, user: User): Promise<Category> {
    const category = await this.findOne(id, user);

    if (category.isDefault) {
      throw new BadRequestException('System default categories cannot be modified');
    }

    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  // 5. Delete Custom Category
  async remove(id: string, user: User): Promise<any> {
    const category = await this.findOne(id, user);

    if (category.isDefault) {
      throw new BadRequestException('System default categories cannot be deleted');
    }

    await this.categoryRepository.remove(category);
    return {message:"Category deleted successfully"};
  }
}