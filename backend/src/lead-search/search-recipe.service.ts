import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_SEARCH_RECIPES } from './constants/search-recipe.defaults';
import { UpdateSearchRecipeDto } from './dto/update-search-recipe.dto';

@Injectable()
export class SearchRecipeService implements OnModuleInit {
  private readonly logger = new Logger(SearchRecipeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    for (const recipe of DEFAULT_SEARCH_RECIPES) {
      await this.prisma.searchRecipe.upsert({
        where: { slug: recipe.slug },
        create: {
          slug: recipe.slug,
          name: recipe.name,
          description: recipe.description,
          query: recipe.query,
          role: recipe.role || null,
          roles: recipe.roles,
          location: recipe.location || null,
          company: recipe.company || null,
          limit: recipe.limit,
          expandTechRoles: recipe.expandTechRoles,
          sortOrder: recipe.sortOrder,
        },
        update: {},
      });
    }

    this.logger.log(`Ensured ${DEFAULT_SEARCH_RECIPES.length} default search recipes`);
  }

  async list() {
    return this.prisma.searchRecipe.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateSearchRecipeDto) {
    const existing = await this.prisma.searchRecipe.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Search recipe ${id} not found`);
    }

    return this.prisma.searchRecipe.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        query: dto.query,
        role: dto.role === '' ? null : dto.role,
        roles: dto.roles,
        location: dto.location === '' ? null : dto.location,
        company: dto.company === '' ? null : dto.company,
        limit: dto.limit,
        expandTechRoles: dto.expandTechRoles,
      },
    });
  }
}
