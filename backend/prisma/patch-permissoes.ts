/**
 * Patch idempotente de permissões (NÃO apaga dados).
 *
 * Corrige o descompasso entre as permissões exigidas nos controllers
 * (@RequirePermissao) e as que o seed original criava. Adiciona as ações
 * OPERAR/CONFIGURAR e o módulo GERENCIAL, e concede às roles existentes
 * (de todos os tenants) conforme a intenção de cada perfil.
 *
 * Rodar: npx ts-node prisma/patch-permissoes.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULOS = ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO', 'CADASTROS', 'AUDITORIA', 'RELATORIOS', 'GERENCIAL'];
const ACOES = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EMITIR', 'APROVAR', 'CANCELAR', 'OPERAR', 'CONFIGURAR'];

type Perm = { id: string; modulo: string; acao: string };

/** Regras de concessão por nome de role (espelham o seed). */
function permitidas(roleNome: string, p: Perm): boolean {
  switch (roleNome) {
    case 'ADMIN':
      return true;
    case 'GERENTE':
      return p.acao !== 'DELETE';
    case 'OPERADOR_CAIXA':
      return (
        ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO'].includes(p.modulo) &&
        ['CREATE', 'READ', 'UPDATE', 'EMITIR'].includes(p.acao)
      );
    case 'ESTOQUISTA':
      return (
        (p.modulo === 'ESTOQUE' && p.acao !== 'DELETE') ||
        (p.modulo === 'CADASTROS' && ['CREATE', 'READ', 'UPDATE'].includes(p.acao)) ||
        (p.modulo === 'PEDIDOS' && p.acao === 'READ')
      );
    default:
      return false; // roles customizadas: não mexe automaticamente
  }
}

async function main() {
  console.log('🔧 Patch de permissões (idempotente)...\n');

  // 1. Garante que todas as permissões (modulo×acao) existem.
  let criadas = 0;
  for (const modulo of MODULOS) {
    for (const acao of ACOES) {
      const r = await prisma.permissao.upsert({
        where: { modulo_acao: { modulo, acao } },
        update: {},
        create: { modulo, acao, descricao: `${acao} em ${modulo}` },
      });
      if (r) criadas++;
    }
  }
  const todas = (await prisma.permissao.findMany()) as Perm[];
  console.log(`✅ ${todas.length} permissões garantidas (${MODULOS.length}×${ACOES.length}).`);

  // 2. Para cada role conhecida, concede as permissões faltantes (sem remover nada).
  const roles = await prisma.role.findMany({ include: { permissoes: true } });
  for (const role of roles) {
    const jaTem = new Set(role.permissoes.map((rp) => rp.permissaoId));
    const alvo = todas.filter((p) => permitidas(role.nome, p));
    const faltando = alvo.filter((p) => !jaTem.has(p.id));
    if (faltando.length === 0) {
      console.log(`ℹ️  ${role.nome}: já completo (${jaTem.size} perms).`);
      continue;
    }
    await prisma.rolePermissao.createMany({
      data: faltando.map((p) => ({ roleId: role.id, permissaoId: p.id })),
      skipDuplicates: true,
    });
    console.log(
      `✅ ${role.nome}: +${faltando.length} permissões (${faltando
        .map((p) => `${p.modulo}:${p.acao}`)
        .join(', ')}).`,
    );
  }

  console.log('\n🎉 Patch concluído. Usuários precisam relogar para o token refletir as novas permissões.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no patch:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
