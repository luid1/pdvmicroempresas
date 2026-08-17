import { Injectable } from '@nestjs/common';
import { ConfiguracaoFiscalService } from '../configuracao-fiscal.service';
import { MockNfeProvider } from './mock.provider';
import { RealNfeProvider } from './real.provider';
import { AutorizacaoNfceResultado, AutorizacaoResultado, CancelamentoResultado, CartaCorrecaoResultado, InutilizacaoResultado, NfeProvider } from './nfe-provider.interface';

/** Seleciona simulação ou transmissão real por filial, sem reiniciar o servidor. */
@Injectable()
export class RoteadorNfeProvider implements NfeProvider {
  readonly nome = 'roteador-fiscal';
  readonly simulacao = false;

  constructor(private config: ConfiguracaoFiscalService, private mock: MockNfeProvider, private real: RealNfeProvider) {}

  private async emissor(documento: any) {
    return await this.config.deveTransmitir(documento?.tenantId, documento?.filialId) ? this.real : this.mock;
  }

  async autorizar(nfe: any): Promise<AutorizacaoResultado> { return (await this.emissor(nfe)).autorizar(nfe); }
  async autorizarNfce(nfe: any): Promise<AutorizacaoNfceResultado> { return (await this.emissor(nfe)).autorizarNfce(nfe); }

  async cancelar(chaveAcesso: string, motivo: string, nfe?: any): Promise<CancelamentoResultado> {
    const provider = await this.config.possuiCredencial(nfe?.tenantId, nfe?.filialId) ? this.real : this.mock;
    return provider.cancelar(chaveAcesso, motivo, nfe);
  }

  async cartaCorrecao(chaveAcesso: string, sequencia: number, texto: string, nfe?: any): Promise<CartaCorrecaoResultado> {
    const provider = await this.config.possuiCredencial(nfe?.tenantId, nfe?.filialId) ? this.real : this.mock;
    return provider.cartaCorrecao(chaveAcesso, sequencia, texto, nfe);
  }

  async inutilizar(dados: { tenantId?: string; filialId?: string; cnpj: string; serie: string; numeroInicial: number; numeroFinal: number; justificativa: string; modelo?: '55' | '65' }): Promise<InutilizacaoResultado> {
    const provider = await this.config.deveTransmitir(dados.tenantId, dados.filialId) ? this.real : this.mock;
    if (!provider.inutilizar) throw new Error('Provedor sem suporte à inutilização.');
    return provider.inutilizar(dados);
  }
}
