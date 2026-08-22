import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { IaService } from '../src/modules/ia/ia.service';

const modoAnterior = process.env.IA_MODO;
const acoesAnteriores = process.env.IA_PERMITE_ACOES;

afterEach(() => {
  if (modoAnterior === undefined) delete process.env.IA_MODO;
  else process.env.IA_MODO = modoAnterior;
  if (acoesAnteriores === undefined) delete process.env.IA_PERMITE_ACOES;
  else process.env.IA_PERMITE_ACOES = acoesAnteriores;
});

function criarService(dashboard: any = {}, prisma: any = {}) {
  process.env.IA_MODO = 'simulado';
  delete process.env.IA_PERMITE_ACOES;
  return new IaService(dashboard, {} as any, {} as any, prisma, {} as any);
}

describe('Lu - consulta autenticada e somente leitura', () => {
  it('recusa ação operacional sem consultar ou gravar no banco', async () => {
    const prisma = new Proxy({}, { get: () => { throw new Error('Prisma não deveria ser acessado'); } });
    const resposta: any = await criarService({}, prisma).comando(
      'tenant-1',
      { role: 'ADMIN', filiais: ['f1'] },
      'Cadastre o produto Café 500g por R$ 18,90',
    );

    assert.equal(resposta.tipo, 'resposta');
    assert.equal(resposta.via, 'somente-leitura');
    assert.match(resposta.texto, /somente consulta/i);
  });

  it('usa apenas a primeira filial vinculada quando o login não envia filialId', async () => {
    let filialConsultada: string | undefined;
    const dashboard = {
      getDashboard: async (_tenantId: string, filtros: any) => {
        filialConsultada = filtros.filialId;
        return {
          periodoLabel: 'Hoje',
          financeiro: { faturamento: 0, faturamentoDelta: 0, vendas: 0, ticketMedio: 0 },
          estoque: { rupturas: 0, valorEstoque: 0, validade: {} },
          topProdutos: [],
        };
      },
    };

    const resposta: any = await criarService(dashboard).comando(
      'tenant-1',
      { role: 'OPERADOR', telas: ['/dashboard'], filiais: ['filial-permitida', 'outra-permitida'] },
      'Como estão minhas vendas?',
    );

    assert.equal(resposta.tipo, 'resposta');
    assert.match(resposta.texto, /caixa|vendas/i);
    assert.equal(filialConsultada, 'filial-permitida');
  });

  it('bloqueia filial que não pertence ao login antes de consultar dados', async () => {
    const service = criarService({ getDashboard: async () => { throw new Error('Não deveria consultar'); } });

    await assert.rejects(
      () => service.resumoDoDia(
        'tenant-1',
        { role: 'OPERADOR', telas: ['/dashboard'], filiais: ['f1'] },
        'f2',
      ),
      ForbiddenException,
    );
  });
});
