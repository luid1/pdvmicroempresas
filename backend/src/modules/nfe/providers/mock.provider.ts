import { Injectable, Logger } from '@nestjs/common';
import {
  NfeProvider,
  AutorizacaoResultado,
  AutorizacaoNfceResultado,
  CancelamentoResultado,
  CartaCorrecaoResultado,
} from './nfe-provider.interface';

/**
 * Provider de SIMULAÇÃO (default). Reproduz EXATAMENTE o comportamento anterior
 * do NFeService (chamarApiSefaz / cancelarSefaz / montarXml), sem transmitir nada.
 * Mantido idêntico para garantir zero regressão ao ligar a abstração.
 */
@Injectable()
export class MockNfeProvider implements NfeProvider {
  readonly nome = 'mock';
  readonly simulacao = true;
  private readonly logger = new Logger(MockNfeProvider.name);

  async autorizar(nfe: any): Promise<AutorizacaoResultado> {
    const fakeChave = `35${new Date().getFullYear()}${(nfe.emitenteCnpj || '')
      .replace(/\D/g, '')
      .padStart(14, '0')}55${String(nfe.serie).padStart(3, '0')}${String(nfe.numero).padStart(9, '0')}1${Date.now()
      .toString()
      .slice(-9)}`;
    const chave = fakeChave.slice(0, 44);
    this.logger.log(`🧪 [SIMULAÇÃO] NF-e ${nfe.serie}/${nfe.numero} — chave gerada ${chave}`);
    return {
      chaveAcesso: chave,
      protocolo: `135${Date.now()}`,
      xml: this.montarXml(nfe, chave),
      danfeUrl: `https://sistema.exemplo.com/danfe/${nfe.id}.pdf`,
      simulacao: true,
    };
  }

  async autorizarNfce(nfe: any): Promise<AutorizacaoNfceResultado> {
    const fakeChave = `35${new Date().getFullYear()}${(nfe.emitenteCnpj || '')
      .replace(/\D/g, '')
      .padStart(14, '0')}65${String(nfe.serie).padStart(3, '0')}${String(nfe.numero).padStart(9, '0')}1${Date.now()
      .toString()
      .slice(-9)}`;
    const chave = fakeChave.slice(0, 44);
    // QR Code de NFC-e em homologação/simulação: payload no formato do portal SEFAZ,
    // porém marcado como simulação (tpAmb=2) e sem assinatura real.
    const urlConsulta = `https://www.homologacao.nfce.fazenda.sp.gov.br/consulta`;
    const qrCode = `${urlConsulta}?p=${chave}|2|2|1|${(Number(nfe.valorNfe) || 0).toFixed(2)}`;
    this.logger.log(`🧪 [SIMULAÇÃO] NFC-e ${nfe.serie}/${nfe.numero} — chave gerada ${chave}`);
    return {
      chaveAcesso: chave,
      protocolo: `165${Date.now()}`,
      xml: this.montarXml({ ...nfe, modelo: '65' }, chave),
      qrCode,
      urlConsulta,
      danfeUrl: `https://sistema.exemplo.com/danfe-nfce/${nfe.id}.pdf`,
      simulacao: true,
    };
  }

  async cancelar(chaveAcesso: string, motivo: string): Promise<CancelamentoResultado> {
    return {
      xml: `<retEvento><infEvento><cStat>135</cStat><xMotivo>${motivo}</xMotivo></infEvento></retEvento>`,
      protocolo: `135${Date.now()}`,
      simulacao: true,
    };
  }

  async cartaCorrecao(
    chaveAcesso: string,
    sequencia: number,
    texto: string,
  ): Promise<CartaCorrecaoResultado> {
    const xml = `<evento><infEvento><tpEvento>110110</tpEvento><nSeqEvento>${sequencia}</nSeqEvento><xCorrecao>${texto}</xCorrecao></infEvento></evento>`;
    return { xml, protocolo: `110110${Date.now()}`, status: 'REGISTRADO', simulacao: true };
  }

  /** Monta um XML simplificado (visual/teste) com itens e impostos. */
  private montarXml(nfe: any, chave: string): string {
    const dets = (nfe.itens || [])
      .map(
        (it: any, i: number) => `
    <det nItem="${i + 1}">
      <prod><cProd>${it.codigo}</cProd><xProd>${it.descricao}</xProd><NCM>${it.ncm}</NCM><CFOP>${it.cfop}</CFOP>
        <uCom>${it.unidade}</uCom><qCom>${it.quantidade}</qCom><vUnCom>${it.valorUnitario}</vUnCom><vProd>${it.valorTotal}</vProd></prod>
      <imposto>
        <ICMS><CSOSN>${it.cstCsosn}</CSOSN><vBC>${it.baseCalcIcms || 0}</vBC><pICMS>${it.aliquotaIcms || 0}</pICMS><vICMS>${it.valorIcms || 0}</vICMS></ICMS>
        <PIS><CST>${it.cstPis}</CST><vPIS>${it.valorPis || 0}</vPIS></PIS>
        <COFINS><CST>${it.cstCofins}</CST><vCOFINS>${it.valorCofins || 0}</vCOFINS></COFINS>
      </imposto>
    </det>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}">
  <ide><natOp>${nfe.naturezaOperacao}</natOp><serie>${nfe.serie}</serie><nNF>${nfe.numero}</nNF><finNFe>${nfe.finalidade || '1'}</finNFe></ide>
  <emit><CNPJ>${(nfe.emitenteCnpj || '').replace(/\D/g, '')}</CNPJ></emit>
  <dest><xNome>${nfe.destRazaoSocial || ''}</xNome></dest>${dets}
  <total><ICMSTot><vProd>${nfe.valorProdutos}</vProd><vICMS>${nfe.valorIcms || 0}</vICMS><vNF>${nfe.valorNfe}</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;
  }
}
