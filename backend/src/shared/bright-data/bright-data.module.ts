import { Global, Module } from '@nestjs/common';
import { BrightDataService } from './bright-data.service';

@Global()
@Module({
  providers: [BrightDataService],
  exports: [BrightDataService],
})
export class BrightDataModule {}
