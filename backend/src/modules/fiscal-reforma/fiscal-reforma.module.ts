import { Module } from '@nestjs/common';
import { FiscalReformaController } from './fiscal-reforma.controller';
import { FiscalReformaService } from './fiscal-reforma.service';

@Module({
  controllers: [FiscalReformaController],
  providers: [FiscalReformaService],
  exports: [FiscalReformaService],
})
export class FiscalReformaModule {}
