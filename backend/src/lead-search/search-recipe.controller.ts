import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UpdateSearchRecipeDto } from './dto/update-search-recipe.dto';
import { SearchRecipeService } from './search-recipe.service';

@Controller('search-recipes')
export class SearchRecipeController {
  constructor(private readonly searchRecipeService: SearchRecipeService) {}

  @Get()
  list() {
    return this.searchRecipeService.list();
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSearchRecipeDto) {
    return this.searchRecipeService.update(id, dto);
  }
}
