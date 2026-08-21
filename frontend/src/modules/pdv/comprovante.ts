/**
 * Comprovantes térmicos do caixa (bobina 58/80mm), impressos via iframe oculto
 * — mesma técnica do cupom não-fiscal (cupom.ts), sem driver ESC/POS amarrado.
 *
 * Três documentos:
 *  1. Cupom Fiscal (DANFCE / NFC-e modelo 65) — com chave de acesso + QR Code
 *     do SEFAZ para o consumidor consultar a nota.
 *  2. Comprovante de Sangria / Suprimento — retirada/reforço na gaveta.
 *  3. Comprovante de Fechamento de Caixa (relatório Z resumido).
 *
 * Largura via VITE_CUPOM_LARGURA=58 | 80 (default: 80mm).
 */
import QRCode from 'qrcode';

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const esc = (s: string) =>
  (s || '').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

function larguraMm(): number {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  return env.VITE_CUPOM_LARGURA === '58' ? 58 : 80;
}

/** Formata a chave de acesso (44 dígitos) em grupos de 4 p/ leitura humana. */
function formatarChave(chave?: string): string {
  const c = (chave || '').replace(/\D/g, '');
  if (c.length !== 44) return chave || '';
  return c.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

const rotuloForma = (f: string) =>
  esc(
    (f || '')
      .replace('_TEF', ' (TEF)')
      .replace('_POS', ' (POS)')
      .replace('CARTAO_CREDITO', 'Cartão Crédito')
      .replace('CARTAO_DEBITO', 'Cartão Débito')
      .replace('CARTAO', 'Cartão')
      .replace('DINHEIRO', 'Dinheiro')
      .replace('PIX', 'PIX'),
  );

/** Imprime um HTML arbitrário num iframe oculto (best-effort, nunca trava a tela). */
function imprimirHtml(html: string) {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow!;
    const limpar = () => setTimeout(() => iframe.remove(), 500);
    win.onafterprint = limpar;
    setTimeout(() => {
      win.focus();
      win.print();
      limpar();
    }, 200);
  } catch {
    /* impressão é best-effort */
  }
}

const baseStyle = (mm: number) => `
  @page { size: ${mm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${mm}mm; margin: 0; padding: 3mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  .b { font-weight: bold; }
  .sm { font-size: 10px; }
  .hr { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0; }
  .tot td { font-size: 14px; font-weight: bold; padding-top: 2px; }
  .foot { text-align: center; margin-top: 6px; font-size: 10px; }
  .qr { display:block; margin: 4px auto 2px; }
  .chave { word-break: break-all; text-align: center; font-size: 11px; letter-spacing: .5px; }
`;

// ─────────────────────────── Cupom Fiscal (NFC-e / DANFCE) ───────────────────────────

export type CupomFiscalItem = {
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnit: number;
  valorTotal: number;
};

export type CupomFiscalPagamento = { forma: string; valor: number };

export type DadosFiscais = {
  numero?: number | null; // número da NFC-e
  serie?: number | string | null;
  chaveAcesso?: string | null;
  protocolo?: string | null;
  qrCode?: string | null; // conteúdo (URL) do QR Code SEFAZ
  urlConsulta?: string | null;
  destCnpjCpf?: string | null;
  simulacao?: boolean;
  status?: string | null;
  erro?: string | null; // mensagem de falha quando a NFC-e não foi autorizada
};

export type CupomFiscalImpressao = {
  loja: string;
  cnpjLoja?: string | null;
  operador: string;
  numeroVenda: number;
  dataEmissao: string | Date;
  itens: CupomFiscalItem[];
  valorTotal: number;
  desconto?: number;
  pagamentos: CupomFiscalPagamento[];
  troco: number;
  fiscal: DadosFiscais;
};

async function qrDataUrl(texto?: string | null): Promise<string | null> {
  if (!texto) return null;
  try {
    return await QRCode.toDataURL(texto, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

/**
 * Imprime o DANFCE (cupom fiscal da NFC-e). Assíncrono porque o QR Code é
 * gerado a partir da URL de consulta do SEFAZ antes de montar o HTML.
 */
export async function imprimirCupomFiscal(c: CupomFiscalImpressao) {
  const mm = larguraMm();
  const data = new Date(c.dataEmissao).toLocaleString('pt-BR');
  const f = c.fiscal || {};
  const qr = await qrDataUrl(f.qrCode || f.urlConsulta);

  const linhas = c.itens
    .map(
      (i, idx) => `<tr>
        <td class="sm">${String(idx + 1).padStart(3, '0')}</td>
        <td class="b" colspan="2">${esc(i.descricao)}</td>
      </tr>
      <tr class="sm">
        <td></td>
        <td>${i.quantidade} ${esc(i.unidade)} x ${brl(i.precoUnit)}</td>
        <td class="r">${brl(i.valorTotal)}</td>
      </tr>`,
    )
    .join('');

  const pagamentos = c.pagamentos
    .map((p) => `<tr><td colspan="2">${rotuloForma(p.forma)}</td><td class="r">${brl(p.valor)}</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>NFC-e ${f.numero ?? c.numeroVenda}</title>
<style>${baseStyle(mm)}</style></head><body>
  <h1>${esc(c.loja)}</h1>
  ${c.cnpjLoja ? `<div class="c sm">CNPJ: ${esc(c.cnpjLoja)}</div>` : ''}
  <div class="c sm b">DANFE NFC-e — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
  ${f.simulacao ? '<div class="c sm b">*** AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL ***</div>' : ''}
  <div class="hr"></div>
  <table>
    <tr><td class="sm b">#</td><td class="sm b">DESCRIÇÃO</td><td class="sm b r">VALOR</td></tr>
    ${linhas}
  </table>
  <div class="hr"></div>
  <table>
    ${c.desconto && c.desconto > 0 ? `<tr><td colspan="2">Desconto</td><td class="r">- ${brl(c.desconto)}</td></tr>` : ''}
    <tr class="tot"><td colspan="2">TOTAL</td><td class="r">${brl(c.valorTotal)}</td></tr>
  </table>
  <div class="hr"></div>
  <table>${pagamentos}${c.troco > 0 ? `<tr><td colspan="2">Troco</td><td class="r">${brl(c.troco)}</td></tr>` : ''}</table>
  <div class="hr"></div>
  <div class="c sm">Nº ${f.numero ?? '—'}  Série ${f.serie ?? '—'}  ${data}</div>
  <div class="c sm">Operador: ${esc(c.operador)}</div>
  ${f.destCnpjCpf ? `<div class="c sm">CONSUMIDOR CPF/CNPJ: ${esc(f.destCnpjCpf)}</div>` : '<div class="c sm">CONSUMIDOR NÃO IDENTIFICADO</div>'}
  <div class="hr"></div>
  <div class="c sm b">Consulte pela Chave de Acesso em:</div>
  <div class="c sm">${esc(f.urlConsulta || 'www.nfce.fazenda.gov.br')}</div>
  ${f.chaveAcesso ? `<div class="chave">${formatarChave(f.chaveAcesso)}</div>` : ''}
  ${f.protocolo ? `<div class="c sm">Protocolo de autorização: ${esc(f.protocolo)}</div>` : ''}
  ${qr ? `<img class="qr" src="${qr}" width="150" height="150" alt="QR Code NFC-e" />` : ''}
  <div class="foot">Obrigado pela preferência!</div>
</body></html>`;

  imprimirHtml(html);
}

// ─────────────────────────── Sangria / Suprimento ───────────────────────────

export type ComprovanteMovimento = {
  tipo: 'SANGRIA' | 'SUPRIMENTO';
  loja: string;
  operador: string;
  valor: number;
  descricao?: string;
  data?: string | Date;
  saldoGaveta?: number; // dinheiro esperado na gaveta após o movimento
};

export function imprimirComprovanteMovimento(m: ComprovanteMovimento) {
  const mm = larguraMm();
  const data = new Date(m.data || Date.now()).toLocaleString('pt-BR');
  const titulo = m.tipo === 'SANGRIA' ? 'COMPROVANTE DE SANGRIA' : 'COMPROVANTE DE SUPRIMENTO';
  const legenda =
    m.tipo === 'SANGRIA' ? 'Retirada de dinheiro da gaveta' : 'Reforço de troco na gaveta';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
<style>${baseStyle(mm)}</style></head><body>
  <h1>${esc(m.loja)}</h1>
  <div class="c b">${titulo}</div>
  <div class="c sm">${legenda}</div>
  <div class="hr"></div>
  <div>${data}</div>
  <div>Operador: ${esc(m.operador)}</div>
  <div class="hr"></div>
  <table>
    <tr class="tot"><td>VALOR</td><td class="r">${brl(m.valor)}</td></tr>
    ${m.saldoGaveta !== undefined ? `<tr><td>Saldo em gaveta</td><td class="r">${brl(m.saldoGaveta)}</td></tr>` : ''}
  </table>
  ${m.descricao ? `<div class="hr"></div><div class="sm">Obs.: ${esc(m.descricao)}</div>` : ''}
  <div class="hr"></div>
  <div style="margin-top:24px" class="c sm">_______________________________</div>
  <div class="c sm">Assinatura do responsável</div>
  <div class="foot">Documento interno — sem valor fiscal.</div>
</body></html>`;

  imprimirHtml(html);
}

// ─────────────────────────── Fechamento de caixa (Z) ───────────────────────────

export type ComprovanteFechamento = {
  loja: string;
  operador: string;
  abertaEm: string | Date;
  fechadaEm?: string | Date | null;
  saldoInicial: number;
  qtdVendas: number;
  totalVendas: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalSangria: number;
  totalSuprimento: number;
  dinheiroEsperadoGaveta: number;
  saldoFinalInformado?: number | null;
  diferenca?: number | null;
  // Conferência por meio de pagamento (informada no fechamento).
  cartaoInformado?: number | null;
  pixInformado?: number | null;
  diferencaCartao?: number | null;
  diferencaPix?: number | null;
};

export function imprimirComprovanteFechamento(z: ComprovanteFechamento) {
  const mm = larguraMm();
  const abertura = new Date(z.abertaEm).toLocaleString('pt-BR');
  const fechamento = z.fechadaEm ? new Date(z.fechadaEm).toLocaleString('pt-BR') : '—';
  const linha = (rot: string, v: number, forte = false) =>
    `<tr class="${forte ? 'tot' : ''}"><td>${rot}</td><td class="r">${brl(v)}</td></tr>`;

  const dif = z.diferenca ?? 0;
  const difRotulo = dif === 0 ? 'Sem diferença' : dif > 0 ? 'Sobra' : 'Falta';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fechamento de Caixa</title>
<style>${baseStyle(mm)}</style></head><body>
  <h1>${esc(z.loja)}</h1>
  <div class="c b">FECHAMENTO DE CAIXA — RELATÓRIO Z</div>
  <div class="hr"></div>
  <div class="sm">Operador: ${esc(z.operador)}</div>
  <div class="sm">Abertura: ${abertura}</div>
  <div class="sm">Fechamento: ${fechamento}</div>
  <div class="sm">Vendas: ${z.qtdVendas}</div>
  <div class="hr"></div>
  <table>
    ${linha('Fundo de troco', z.saldoInicial)}
    ${linha('Vendas em dinheiro', z.totalDinheiro)}
    ${linha('Vendas no cartão', z.totalCartao)}
    ${linha('Vendas no PIX', z.totalPix)}
    ${linha('Suprimentos', z.totalSuprimento)}
    ${linha('Sangrias', -z.totalSangria)}
  </table>
  <div class="hr"></div>
  <table>
    ${linha('Total vendido', z.totalVendas, true)}
    ${linha('Esperado na gaveta', z.dinheiroEsperadoGaveta, true)}
    ${z.saldoFinalInformado != null ? linha('Contado na gaveta', z.saldoFinalInformado, true) : ''}
    ${z.diferenca != null ? linha(difRotulo, Math.abs(dif), true) : ''}
  </table>
  ${
    z.cartaoInformado != null || z.pixInformado != null
      ? `<div class="hr"></div><table>
    ${z.cartaoInformado != null ? linha('Cartão informado', z.cartaoInformado) : ''}
    ${z.diferencaCartao != null ? linha('Diferença (cartão)', z.diferencaCartao) : ''}
    ${z.pixInformado != null ? linha('PIX informado', z.pixInformado) : ''}
    ${z.diferencaPix != null ? linha('Diferença (PIX)', z.diferencaPix) : ''}
  </table>`
      : ''
  }
  <div class="hr"></div>
  <div style="margin-top:24px" class="c sm">_______________________________</div>
  <div class="c sm">Conferência / Responsável</div>
  <div class="foot">Documento interno — sem valor fiscal.</div>
</body></html>`;

  imprimirHtml(html);
}
