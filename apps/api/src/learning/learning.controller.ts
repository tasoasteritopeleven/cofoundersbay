import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LearningService, CreateLearningResourceDto, UpdateLearningResourceDto } from './learning.service';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.learningService.findAll({
      type: type as any,
      category,
      difficulty: difficulty as any,
      search,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('categories')
  async getCategories() {
    const categories = await this.learningService.getCategories();
    return { categories };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.learningService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: CreateLearningResourceDto) {
    const resource = await this.learningService.create(req.user.id, dto);
    return { resource };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateLearningResourceDto,
  ) {
    const isAdmin = req.user.role === 'admin';
    const resource = await this.learningService.update(id, req.user.id, dto, isAdmin);
    return { resource };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user.role === 'admin';
    return this.learningService.delete(id, req.user.id, isAdmin);
  }
}
