import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_SEARCH_PROVIDER, LEAD_SEARCH_QUEUE } from './constants';
import { LeadSearchController } from './lead-search.controller';
import { LeadSearchProcessor } from './lead-search.processor';
import { LeadSearchService } from './lead-search.service';
import { MockLeadSearchProvider } from './providers/mock-lead-search.provider';

@Module({})
export class LeadSearchModule {
  static register(): DynamicModule {
    const useQueue =
      process.env.LEAD_SEARCH_SYNC !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadSearchModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_SEARCH_QUEUE })]
        : [],
      controllers: [LeadSearchController],
      providers: [
        LeadSearchService,
        ...(useQueue ? [LeadSearchProcessor] : []),
        {
          provide: LEAD_SEARCH_PROVIDER,
          useClass: MockLeadSearchProvider,
        },
      ],
      exports: [LeadSearchService],
    };
  }
}

export function bullRootImports() {
  const useQueue =
    process.env.LEAD_SEARCH_SYNC !== 'true' &&
    Boolean(process.env.REDIS_URL);

  if (!useQueue) {
    return [];
  }

  return [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
  ];
}
