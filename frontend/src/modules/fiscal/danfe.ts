// Gera uma DANFE no layout padrão (visual) para impressão — MODO TESTE (sem SEFAZ).
const R$ = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: any, d = 4) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

// Código de barras "fake" (visual) a partir da chave — barras de larguras variáveis.
function barras(chave: string) {
  const c = (chave || '').replace(/\D/g, '') || '0';
  let html = '';
  for (let i = 0; i < c.length; i++) {
    const d = parseInt(c[i], 10);
    const bw = 1 + (d % 4);           // largura da barra preta
    const gw = 1 + ((d * 3 + i) % 3); // largura do espaço
    html += `<span style="display:inline-block;width:${bw}px;height:42px;background:#000"></span>`;
    html += `<span style="display:inline-block;width:${gw}px;height:42px;background:#fff"></span>`;
  }
  return html;
}

export function imprimirDanfe(nfe: any) {
  const end: any = nfe.cliente?.enderecoJson || {};
  const itens = nfe.itens || [];
  const somaIcmsBase = itens.reduce((s: number, i: any) => s + Number(i.baseCalcIcms || 0), 0);
  const somaIcms = itens.reduce((s: number, i: any) => s + Number(i.valorIcms || 0), 0);

  const itensHtml = itens.map((it: any) => `
    <tr>
      <td>${it.codigo || it.produto?.codigo || ''}</td>
      <td>${it.descricao}</td>
      <td class="c">${it.ncm || ''}</td>
      <td class="c">${it.cstCsosn || ''}</td>
      <td class="c">${it.cfop || ''}</td>
      <td class="c">${it.unidade || ''}</td>
      <td class="r">${num(it.quantidade)}</td>
      <td class="r">${R$(it.valorUnitario)}</td>
      <td class="r">${R$(it.valorTotal)}</td>
      <td class="r">${R$(it.baseCalcIcms)}</td>
      <td class="r">${R$(it.valorIcms)}</td>
      <td class="r">${num(it.aliquotaIcms, 2)}</td>
    </tr>`).join('');

  const chave = nfe.chaveAcesso || '';
  const chaveFmt = chave.replace(/(.{4})/g, '$1 ').trim();
  const enderecoDest = `${[end.rua, end.numero].filter(Boolean).join(', ')}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DANFE ${String(nfe.numero).padStart(9, '0')}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:8.5px;color:#000;margin:0;padding:10px;background:#e5e7eb}
  .page{width:760px;min-height:1060px;margin:0 auto;background:#fff;padding:8px;position:relative;overflow:hidden}
  .logo-wm{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:.06;pointer-events:none;z-index:0}
  .b{border:1px solid #000}
  .danfe table{border-collapse:collapse;width:100%}
  .lbl{font-size:6px;text-transform:uppercase;color:#000;letter-spacing:.2px}
  .val{font-size:9px;font-weight:bold}
  .cell{padding:2px 4px;border:1px solid #000}
  .flex{display:flex}
  .grow{flex:1}
  .c{text-align:center}.r{text-align:right}
  .tit{font-weight:bold}
  .watermark{position:fixed;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:60px;color:rgba(200,0,0,.12);font-weight:900;pointer-events:none}
  .canhoto{border:1px solid #000;border-bottom:1px dashed #000;display:flex;font-size:7px}
  .danfebox{text-align:center;width:120px;border-left:1px solid #000;border-right:1px solid #000;padding:2px}
  .danfebox b{font-size:13px}
  .barcode{display:flex;align-items:center;height:46px;overflow:hidden;white-space:nowrap}
  table.itens th{background:#eee;border:1px solid #000;padding:2px;font-size:6.5px;text-transform:uppercase}
  table.itens td{border:1px solid #000;padding:1.5px 3px;font-size:7.5px}
  .toolbar{width:760px;margin:0 auto 8px}
  .btn{padding:8px 16px;font-size:12px;cursor:pointer;border:1px solid #999;border-radius:6px;background:#fff}
  @media print{ body{background:#fff;padding:0} .toolbar{display:none} .page{width:auto} }
</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.print()">🖨️ Imprimir</button></div>
<div class="page danfe">
  <img class="logo-wm" src="/logo-mercado.png" alt="" />
  <div class="watermark">SEM VALOR FISCAL</div>

  <!-- Canhoto -->
  <div class="canhoto">
    <div style="flex:1;padding:3px">
      <div>RECEBEMOS DE <b>HETROS IMP. E EXP. LTDA</b> OS PRODUTOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO</div>
      <div class="flex" style="margin-top:4px">
        <div class="cell" style="width:160px"><div class="lbl">Data de recebimento</div><div style="height:12px"></div></div>
        <div class="cell grow"><div class="lbl">Identificação e assinatura do recebedor</div><div style="height:12px"></div></div>
      </div>
    </div>
    <div style="width:150px;border-left:1px solid #000;padding:3px;text-align:center">
      <b>NF-e</b><br>Nº ${String(nfe.numero).padStart(9, '0')}<br>SÉRIE ${nfe.serie}
    </div>
  </div>

  <!-- Cabeçalho principal -->
  <div class="b flex" style="margin-top:4px">
    <div class="grow cell" style="border:none">
      <div class="flex" style="align-items:center;gap:8px">
        <img src="/logo-mercado.png" alt="Mercado" style="height:42px;width:42px;object-fit:contain" />
        <div>
          <div class="val" style="font-size:13px">HETROS IMP. E EXP. LTDA</div>
          <div>AV DOUTOR GASTÃO VIDIGAL, SN - BOX 19</div>
          <div>VILA LEOPOLDINA · SÃO PAULO - SP</div>
          <div>CNPJ: ${nfe.emitenteCnpj || '—'}</div>
        </div>
      </div>
    </div>
    <div class="danfebox">
      <b>DANFE</b>
      <div style="font-size:6px">Documento Auxiliar da Nota Fiscal Eletrônica</div>
      <div style="display:flex;justify-content:center;gap:6px;margin:3px 0;font-size:7px">
        <span>0 - ENTRADA</span><span style="border:1px solid #000;padding:0 4px;font-weight:bold">1</span><span>1 - SAÍDA</span>
      </div>
      <div style="font-size:9px"><b>Nº</b> ${String(nfe.numero).padStart(9, '0')}</div>
      <div style="font-size:9px"><b>SÉRIE</b> ${nfe.serie} · FL 1/1</div>
    </div>
    <div style="width:230px;border-left:1px solid #000;padding:3px;text-align:center">
      <div class="barcode">${barras(chave)}</div>
      <div class="lbl">Chave de acesso</div>
      <div style="font-family:monospace;font-size:8px;word-break:break-all">${chaveFmt || '—'}</div>
    </div>
  </div>

  <div class="b cell flex" style="margin-top:-1px">
    <div class="grow"><div class="lbl">Natureza da operação</div><div class="val">${nfe.naturezaOperacao || 'VENDA DE MERCADORIAS'}</div></div>
    <div style="width:300px;border-left:1px solid #000;padding-left:4px"><div class="lbl">Protocolo de autorização de uso</div><div class="val">${nfe.protocolo || '—'} · ${nfe.dataEmissao ? new Date(nfe.dataEmissao).toLocaleString('pt-BR') : ''}</div></div>
  </div>
  <div class="b cell flex" style="margin-top:-1px">
    <div class="grow"><div class="lbl">Inscrição estadual</div><div class="val">ISENTO</div></div>
    <div class="grow" style="border-left:1px solid #000;padding-left:4px"><div class="lbl">Insc. estadual subst. trib.</div><div class="val">—</div></div>
    <div class="grow" style="border-left:1px solid #000;padding-left:4px"><div class="lbl">CNPJ</div><div class="val">${nfe.emitenteCnpj || '—'}</div></div>
  </div>

  <!-- Destinatário -->
  <div class="tit" style="margin-top:4px;font-size:7px">DESTINATÁRIO / REMETENTE</div>
  <div class="b flex">
    <div class="cell grow" style="border:none"><div class="lbl">Nome / Razão Social</div><div class="val">${nfe.destRazaoSocial || nfe.cliente?.razaoSocial || ''}</div></div>
    <div class="cell" style="width:170px"><div class="lbl">CNPJ / CPF</div><div class="val">${nfe.destCnpjCpf || nfe.cliente?.cnpjCpf || '—'}</div></div>
    <div class="cell" style="width:110px"><div class="lbl">Data emissão</div><div class="val">${dt(nfe.dataEmissao)}</div></div>
  </div>
  <div class="b flex" style="margin-top:-1px">
    <div class="cell grow" style="border:none"><div class="lbl">Endereço</div><div class="val">${enderecoDest || '—'}</div></div>
    <div class="cell" style="width:150px"><div class="lbl">Bairro</div><div class="val">${end.bairro || '—'}</div></div>
    <div class="cell" style="width:110px"><div class="lbl">CEP</div><div class="val">${end.cep || '—'}</div></div>
  </div>
  <div class="b flex" style="margin-top:-1px">
    <div class="cell grow" style="border:none"><div class="lbl">Município</div><div class="val">${end.cidade || '—'}</div></div>
    <div class="cell" style="width:60px"><div class="lbl">UF</div><div class="val">${end.uf || '—'}</div></div>
    <div class="cell" style="width:170px"><div class="lbl">Inscrição estadual</div><div class="val">—</div></div>
    <div class="cell" style="width:110px"><div class="lbl">Data saída</div><div class="val">${dt(nfe.dataEmissao)}</div></div>
  </div>

  <!-- Cálculo do imposto -->
  <div class="tit" style="margin-top:4px;font-size:7px">CÁLCULO DO IMPOSTO</div>
  <div class="b flex">
    <div class="cell grow"><div class="lbl">Base de cálc. ICMS</div><div class="val r">${R$(somaIcmsBase)}</div></div>
    <div class="cell grow"><div class="lbl">Valor do ICMS</div><div class="val r">${R$(somaIcms)}</div></div>
    <div class="cell grow"><div class="lbl">BC ICMS ST</div><div class="val r">0,00</div></div>
    <div class="cell grow"><div class="lbl">Valor ICMS ST</div><div class="val r">0,00</div></div>
    <div class="cell grow"><div class="lbl">Total dos produtos</div><div class="val r">${R$(nfe.valorProdutos)}</div></div>
  </div>
  <div class="b flex" style="margin-top:-1px">
    <div class="cell grow"><div class="lbl">Valor do frete</div><div class="val r">${R$(nfe.valorFrete)}</div></div>
    <div class="cell grow"><div class="lbl">Valor do seguro</div><div class="val r">0,00</div></div>
    <div class="cell grow"><div class="lbl">Desconto</div><div class="val r">${R$(nfe.valorDesconto)}</div></div>
    <div class="cell grow"><div class="lbl">Outras despesas</div><div class="val r">0,00</div></div>
    <div class="cell grow"><div class="lbl">Valor do IPI</div><div class="val r">0,00</div></div>
    <div class="cell grow" style="background:#f1f5f9"><div class="lbl">VALOR TOTAL DA NOTA</div><div class="val r" style="font-size:11px">${R$(nfe.valorNfe)}</div></div>
  </div>

  <!-- Transportador -->
  <div class="tit" style="margin-top:4px;font-size:7px">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
  <div class="b flex">
    <div class="cell grow"><div class="lbl">Nome / Razão Social</div><div class="val">—</div></div>
    <div class="cell" style="width:120px"><div class="lbl">Frete por conta</div><div class="val">0 - EMITENTE</div></div>
    <div class="cell" style="width:90px"><div class="lbl">Placa</div><div class="val">—</div></div>
    <div class="cell" style="width:80px"><div class="lbl">Qtd. volumes</div><div class="val r">—</div></div>
  </div>

  <!-- Produtos -->
  <div class="tit" style="margin-top:4px;font-size:7px">DADOS DOS PRODUTOS / SERVIÇOS</div>
  <table class="itens">
    <thead><tr>
      <th>CÓD</th><th>DESCRIÇÃO</th><th>NCM</th><th>CST</th><th>CFOP</th><th>UN</th>
      <th>QTD</th><th>VL UNIT</th><th>VL TOTAL</th><th>BC ICMS</th><th>VL ICMS</th><th>ALÍQ</th>
    </tr></thead>
    <tbody>${itensHtml}</tbody>
  </table>

  <!-- Dados adicionais -->
  <div class="tit" style="margin-top:4px;font-size:7px">DADOS ADICIONAIS</div>
  <div class="b cell" style="height:46px">
    <div class="lbl">Informações complementares</div>
    <div>Documento emitido em AMBIENTE DE TESTE — SEM VALOR FISCAL. Pedido nº ${nfe.pedido?.numero || ''}.</div>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
