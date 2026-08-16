import test from 'node:test';
import assert from 'node:assert/strict';
import { RealNfeProvider } from '../src/modules/nfe/providers/real.provider';

const notaBase = {
  id: 'nfe-1', serie: '1', numero: 10, tipoOperacao: 'SAIDA', finalidade: '1',
  naturezaOperacao: 'VENDA DE MERCADORIAS', emitenteCnpj: '12.345.678/0001-90',
  valorProdutos: 100, valorNfe: 100, valorFrete: 0, valorDesconto: 0, formaPagamento: 'PIX',
  filial: { nome: 'Loja Teste', cnpj: '12.345.678/0001-90', ie: '123', crt: '3', endereco: { rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01001000', codigoIbge: '3550308' } },
  destCnpjCpf: '12345678901', destRazaoSocial: 'Consumidor', destEnderecoJson: { rua: 'Rua B', numero: '20', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01002000', codigoIbge: '3550308' },
  itens: [{ codigo: 'P001', descricao: 'Produto', ncm: '07020000', cfop: '5102', unidade: 'UN', quantidade: 2, valorUnitario: 50, valorTotal: 100, valorDesconto: 0, origemProd: '0', cstCsosn: '00', cstPis: '01', cstCofins: '01', produto: { descricaoFiscal: 'PRODUTO TESTE', codigoBarras: '7891234567890', gtinTributavel: '7891234567890', fatorConversao: 1, cstIbsCbs: '000', classTribIbsCbs: '000001', aliquotaIbsUf: 0.1, aliquotaIbsMun: 0, aliquotaCbs: 0.9 } }],
};

test('payload Focus inclui identificação, pagamentos, GTIN e IBS/CBS de 2026', () => {
  const provider = new RealNfeProvider();
  const payload = (provider as any).montarPayload(notaBase, false);
  assert.equal(payload.cnpj_emitente, '12345678000190');
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '17');
  assert.equal(payload.items[0].codigo_barras_tributavel, '7891234567890');
  assert.equal(payload.items[0].ibs_cbs_situacao_tributaria, '000');
  assert.equal(payload.items[0].ibs_uf_valor, 0.1);
  assert.equal(payload.items[0].cbs_valor, 0.9);
});

test('regime regular bloqueia produto sem CST IBS/CBS e cClassTrib', () => {
  const provider = new RealNfeProvider();
  const semClassificacao = structuredClone(notaBase);
  delete (semClassificacao.itens[0].produto as any).cstIbsCbs;
  assert.throws(() => (provider as any).montarPayload(semClassificacao, false), /sem CST IBS\/CBS ou cClassTrib/);
});
