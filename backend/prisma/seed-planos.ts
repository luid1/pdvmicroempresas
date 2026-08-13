/**
 * Catálogo de planos (self-service) — idempotente.
 * Rodar: npx ts-node prisma/seed-planos.ts
 *
 * Os `features` são as flags que o gate de plano vai checar por rota/módulo.
 * `mpPlanId` fica vazio até criarmos os planos de assinatura no Mercado Pago.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Blocos de features reutilizados entre os planos (herança acumulativa).
const ESSENCIAL = [
  'PDV', // frente de caixa (bipe, peso, desconto, troco, sangria/suprimento, fechamento Z, estorno)
  'ESTOQUE', // saldo, entradas/saídas
  'CADASTROS', // produtos, clientes, fornecedores
  'RELATORIOS_BASICOS', // vendas do dia, X/Z
];

const PROFISSIONAL = [
  ...ESSENCIAL,
  'NFCE', // cupom fiscal eletrônico (modelo 65)
  'FINANCEIRO', // contas a pagar/receber
  'TESOURARIA', // fluxo de caixa / conciliação
  'TEF', // maquininha integrada
  'VALIDADE', // controle de perecíveis (FEFO)
  'PRECIFICACAO', // markup / margem
  'DEVOLUCOES',
  'RELATORIOS_VENDAS', // curva ABC, ruptura, margem
];

const COMPLETO = [
  ...PROFISSIONAL,
  'NFE', // nota fiscal modelo 55 (venda/compra)
  'MULTIFILIAL', // transferências entre lojas, estoque consolidado
  'IA_PEDIDOS', // captação por WhatsApp/voz (interpretador)
  'RECORRENCIAS', // lançamentos financeiros recorrentes
  'PLANO_CONTAS', // DRE / centro de custo
  'AUDITORIA', // log completo
  'RELATORIOS_GERENCIAIS', // dashboard do dono, comparativos
  'NOTIFICACOES', // alertas de ruptura/validade/metas
  'API', // webhooks / integrações
];

const PLANOS = [
  {
    codigo: 'ESSENCIAL',
    nome: 'Essencial',
    descricao: 'Para começar: um caixa, um operador. Passe produtos e venda hoje.',
    precoMensal: 89.0,
    maxUsuarios: 1,
    maxFiliais: 1,
    maxPdvs: 1,
    trialDias: 7,
    ordem: 1,
    features: ESSENCIAL,
  },
  {
    codigo: 'PROFISSIONAL',
    nome: 'Profissional',
    descricao: 'Loja organizada: cupom fiscal (NFC-e), financeiro, maquininha e validade.',
    precoMensal: 189.0,
    maxUsuarios: 3,
    maxFiliais: 1,
    maxPdvs: 2,
    trialDias: 7,
    ordem: 2,
    features: PROFISSIONAL,
  },
  {
    codigo: 'COMPLETO',
    nome: 'Completo',
    descricao: 'Gestão total: NF-e, multi-loja, IA de pedidos, DRE, auditoria e integrações.',
    precoMensal: 489.0,
    maxUsuarios: 15,
    maxFiliais: 3,
    maxPdvs: 10,
    trialDias: 7,
    ordem: 3,
    features: COMPLETO,
  },
  {
    codigo: 'ENTERPRISE',
    nome: 'Enterprise',
    descricao: 'Sob medida: filiais e usuários ilimitados, SLA, onboarding e treinamento.',
    precoMensal: 0.0, // sob consulta
    maxUsuarios: null, // ilimitado
    maxFiliais: 999,
    maxPdvs: 999,
    trialDias: 0,
    ordem: 4,
    features: COMPLETO, // + negociado
  },
];

async function main() {
  console.log('🗂️  Semeando catálogo de planos (idempotente)...\n');
  for (const p of PLANOS) {
    const r = await prisma.plano.upsert({
      where: { codigo: p.codigo },
      update: {
        nome: p.nome,
        descricao: p.descricao,
        precoMensal: p.precoMensal,
        maxUsuarios: p.maxUsuarios,
        maxFiliais: p.maxFiliais,
        maxPdvs: p.maxPdvs,
        trialDias: p.trialDias,
        ordem: p.ordem,
        features: p.features,
      },
      create: p,
    });
    console.log(
      `✅ ${r.nome} (R$ ${Number(r.precoMensal).toFixed(2)}) — ${r.features.length} features · ` +
        `${r.maxUsuarios ?? '∞'} usuário(s), ${r.maxFiliais} filial(is), ${r.maxPdvs} caixa(s).`,
    );
  }
  console.log('\n🎉 Catálogo pronto. Falta vincular cada plano ao Mercado Pago (mpPlanId).');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao semear planos:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
