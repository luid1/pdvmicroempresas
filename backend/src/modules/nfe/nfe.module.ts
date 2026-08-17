import { Module } from '@nestjs/common';
import { NFeService } from './nfe.service';
import { NFeController } from './nfe.controller';
import { NfceService } from './nfce.service';
import { NfceController } from './nfce.controller';
import { EstoqueModule } from '../estoque/estoque.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { MockNfeProvider } from './providers/mock.provider';
import { RealNfeProvider } from './providers/real.provider';
import { nfeProviderFactory } from './providers/nfe-provider.factory';
import { CertificadoService } from './certificado.service';
import { CertificadoController } from './certificado.controller';
import { ConfiguracaoFiscalService } from './configuracao-fiscal.service';
import { RoteadorNfeProvider } from './providers/roteador.provider';

@Module({
  imports: [EstoqueModule, FiscalModule],
  providers: [
    NFeService,
    NfceService,
    MockNfeProvider,
    RealNfeProvider,
    nfeProviderFactory,
    CertificadoService,
    ConfiguracaoFiscalService,
    RoteadorNfeProvider,
  ],
  controllers: [NFeController, NfceController, CertificadoController],
  exports: [NFeService, NfceService, ConfiguracaoFiscalService],
})
export class NFeModule {}
