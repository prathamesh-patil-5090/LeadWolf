import { Controller, Get, Post } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('status')
  getStatus() {
    return this.settingsService.getStatus();
  }

  @Post('reset-database')
  resetDatabase() {
    return this.settingsService.resetDatabase();
  }

  @Post('reset-redis')
  resetRedis() {
    return this.settingsService.resetRedis();
  }
}
