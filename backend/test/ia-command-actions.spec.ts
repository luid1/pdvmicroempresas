import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { IaService } from '../src/modules/ia/ia.service';

const originalModo = process.env.IA_MODO;
const originalAcoes = process.env.IA_PERMITE_ACOES;
afterEach(() => {
  process.env.IA_MODO = originalModo;
  if (originalAcoes === undefined) delete process.env.IA_PERMITE_ACOES;
  else process.env.IA_PERMITE_ACOES = originalAcoes;
});

function service(prisma: any = {}) {
  process.env.IA_MODO = 'simulado';
  process.env.IA_PERMITE_ACOES = 'true';
  return new IaService({} as any, {} as any, {} as any, prisma, {} as any);
}

describe('Lu - rascunhos operacionais', () => {
  it('pede produto e quantidade antes de preparar a transferencia', async () => {
    const r: any = await service().comando(
      'tenant-1',
      { role: 'ADMIN' },
      'Faca uma transferencia entre filiais do Mercado Central para a Lojinha do Seu Ze',
    );
    assert.equal(r.tipo, 'esclarecer');
    assert.match(r.texto, /produto/i);
    assert.match(r.texto, /quantidade/i);
  });

  it('resolve filiais e produto por nome e devolve rascunho sem gravar', async () => {
    const prisma = {
      filial: { findMany: async () => [
        { id: 'f1', codigo: 'MC', nome: 'Mercado Central' },
        { id: 'f2', codigo: 'LZ', nome: 'Lojinha do Seu Ze' },
      ] },
      produto: { findMany: async () => [
        { id: 'p1', codigo: 'AR01', descricao: 'Arroz', unidadeMedida: { sigla: 'UN' } },
      ] },
      estoqueSaldo: { aggregate: async () => ({ _sum: { quantidadeDisponivel: 25 } }) },
    };
    const r: any = await service(prisma).comando(
      'tenant-1',
      { role: 'ADMIN' },
      'Transfira do Mercado Central para a Lojinha do Seu Ze, produto Arroz quantidade 10',
    );
    assert.equal(r.tipo, 'acao');
    assert.equal(r.acao, 'transferir-estoque');
    assert.equal(r.rascunho.filialOrigemId, 'f1');
    assert.equal(r.rascunho.filialDestinoId, 'f2');
    assert.equal(r.rascunho.produtoId, 'p1');
    assert.equal(r.rascunho.quantidade, 10);
    assert.equal(r.rascunho.saldoDisponivel, 25);
  });

  it('prepara um cadastro de produto editavel', async () => {
    const r: any = await service().comando(
      'tenant-1',
      { role: 'ADMIN' },
      'Cadastre o produto Cafe 500g por R$ 18,90, codigo de barras 7891234567890',
    );
    assert.equal(r.tipo, 'acao');
    assert.equal(r.acao, 'cadastrar-produto');
    assert.equal(r.rascunho.descricao, 'Cafe 500g');
    assert.equal(r.rascunho.precoVenda, 18.9);
    assert.equal(r.rascunho.codigoBarras, '7891234567890');
  });
});
