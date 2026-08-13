/**
 * Impressão de cupom (não fiscal) em impressora térmica.
 *
 * Não depende de driver ESC/POS específico: monta o cupom em HTML com largura
 * de bobina (58/80mm) e chama window.print() num iframe oculto — o operador
 * seleciona a impressora térmica como padrão do navegador. Assim funciona com
 * qualquer térmica instalada no sistema, sem hardware amarrado ao código.
 *
 * Largura via VITE_CUPOM_LARGURA=58 | 80 (default: 80mm).
 */

export type CupomItem = {
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnit: number;
  valorTotal: number;
};

export type CupomPagamento = {
  forma: string;
  valor: number;
  troco?: number;
};

export type CupomImpressao = {
  loja: string;
  operador: string;
  numero: number;
  formaPagamento?: string;
  dataEmissao: string | Date;
  itens: CupomItem[];
  valorTotal: number;
  desconto?: number;
  pagamentos: CupomPagamento[];
  troco: number;
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const esc = (s: string) =>
  (s || '').replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

const rotuloForma = (f: string) =>
  esc(
    (f || '')
      .replace('_TEF', ' (TEF)')
      .replace('_POS', ' (POS)')
      .replace('CARTAO', 'Cartão')
      .replace('DINHEIRO', 'Dinheiro'),
  );

function larguraMm(): number {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  return env.VITE_CUPOM_LARGURA === '58' ? 58 : 80;
}

function montarHtml(c: CupomImpressao): string {
  const mm = larguraMm();
  const data = new Date(c.dataEmissao).toLocaleString('pt-BR');
  const linhas = c.itens
    .map(
      (i) => `<tr>
        <td class="d">${esc(i.descricao)}</td>
      </tr>
      <tr class="sub">
        <td>${i.quantidade} ${esc(i.unidade)} x ${brl(i.precoUnit)}</td>
        <td class="r">${brl(i.valorTotal)}</td>
      </tr>`,
    )
    .join('');

  const pagamentos = c.pagamentos
    .map((p) => `<tr><td>${rotuloForma(p.forma)}</td><td class="r">${brl(p.valor)}</td></tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Cupom ${c.numero}</title>
<style>
  @page { size: ${mm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${mm}mm; margin: 0; padding: 3mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  .hr { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0; }
  .sub td { color: #000; font-size: 11px; padding-bottom: 2px; }
  .d { font-weight: bold; }
  .tot td { font-size: 14px; font-weight: bold; padding-top: 2px; }
  .foot { text-align: center; margin-top: 6px; font-size: 11px; }
</style></head><body>
  <h1>${esc(c.loja)}</h1>
  <div class="c">CUPOM NÃO FISCAL</div>
  <div class="hr"></div>
  <div>Venda #${c.numero}</div>
  <div>${data}</div>
  <div>Operador: ${esc(c.operador)}</div>
  <div class="hr"></div>
  <table>${linhas}</table>
  <div class="hr"></div>
  <table>
    ${c.desconto && c.desconto > 0 ? `<tr><td>Desconto</td><td class="r">- ${brl(c.desconto)}</td></tr>` : ''}
    <tr class="tot"><td>TOTAL</td><td class="r">${brl(c.valorTotal)}</td></tr>
  </table>
  <div class="hr"></div>
  <table>${pagamentos}${
    c.troco > 0 ? `<tr><td>Troco</td><td class="r">${brl(c.troco)}</td></tr>` : ''
  }</table>
  <div class="foot">Obrigado pela preferência!</div>
</body></html>`;
}

/**
 * Preferência POR TERMINAL de impressão automática do cupom após cada venda.
 *
 * Fica DESLIGADA por padrão: num navegador comum, imprimir dispara o diálogo
 * do Chrome a cada venda (chatice). A loja que tem impressora térmica + modo
 * silencioso do Chrome (--kiosk-printing) liga aqui e o cupom sai direto.
 * O botão "Reimprimir cupom" continua disponível independente disto.
 *
 * Guardado em localStorage porque é config da máquina do caixa, não da conta.
 */
const CUPOM_AUTO_KEY = 'pdv.cupomAuto';

export function getCupomAuto(): boolean {
  try {
    return localStorage.getItem(CUPOM_AUTO_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCupomAuto(ligado: boolean): void {
  try {
    localStorage.setItem(CUPOM_AUTO_KEY, ligado ? '1' : '0');
  } catch {
    /* localStorage indisponível — segue sem persistir */
  }
}

/** Imprime o cupom num iframe oculto, sem sair da tela do PDV. */
export function imprimirCupom(c: CupomImpressao) {
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
    doc.write(montarHtml(c));
    doc.close();

    const win = iframe.contentWindow!;
    const limpar = () => setTimeout(() => iframe.remove(), 500);
    win.onafterprint = limpar;
    setTimeout(() => {
      win.focus();
      win.print();
      limpar();
    }, 150);
  } catch {
    /* impressão é best-effort — nunca deve travar a venda */
  }
}
