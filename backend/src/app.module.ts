import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  bullRootImports,
  LeadSearchModule,
} from './lead-search/lead-search.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...bullRootImports(),
    PrismaModule,
    LeadSearchModule.register(),
  ],
})
export class AppModule {}
