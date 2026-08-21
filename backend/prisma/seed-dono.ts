/**
 * Seed: cria o DONO DA PLATAFORMA (super-admin do SaaS).
 *
 * O dono não é um dos perfis da loja (ADMIN/GERENTE/OPERADOR/ESTOQUE) — é o
 * responsável pela plataforma inteira, acima de todos os tenants. Tecnicamente
 * ele ainda precisa pertencer a um tenant e a um role (exigência do schema), por
 * isso o ancoramos no tenant "Mercado Central" com o role ADMIN, mas o que lhe dá
 * poderes de plataforma é a flag `isSuperAdmin = true`.
 *
 * O login detecta esse usuário no passo de e-mail+senha e o envia direto para
 * /plataforma, pulando a escolha de loja/perfil.
 *
 * Rodar: npx ts-node prisma/seed-dono.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DONO_EMAIL = 'dono@mercado.com';
const DONO_SENHA = 'dono123';
const ADMIN_EMAIL = 'admin@mercado.com';

async function main() {
  console.log('🌱 Seed do DONO DA PLATAFORMA...\n');

  // ── 1. Tenant âncora: Mercado Central ──────────────────────────
  const tenant = await prisma.tenant.findUnique({ where: { cnpj: '00.000.000/0001-00' } });
  if (!tenant) {
    throw new Error('Tenant "Mercado Central" não encontrado. Rode o seed principal antes (npx ts-node prisma/seed.ts).');
  }

  // ── 2. Role ADMIN desse tenant ─────────────────────────────────
  const roleAdmin = await prisma.role.findUnique({
    where: { tenantId_nome: { tenantId: tenant.id, nome: 'ADMIN' } },
  });
  if (!roleAdmin) {
    throw new Error('Role ADMIN não encontrada no tenant. Rode o seed principal antes.');
  }

  // ── 3. Filiais do admin (para espelhar no dono) ────────────────
  const admin = await prisma.usuario.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: ADMIN_EMAIL } },
    include: { filiais: true },
  });
  const filialIds = admin?.filiais.map((f) => f.filialId) ?? [];

  // ── 4. Cria/atualiza o dono@mercado.com ────────────────────────
  const passwordHash = await bcrypt.hash(DONO_SENHA, 12);
  const existente = await prisma.usuario.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: DONO_EMAIL } },
  });

  if (!existente) {
    const dono = await prisma.usuario.create({
      data: {
        tenantId:     tenant.id,
        roleId:       roleAdmin.id,
        nome:         'Dono da Plataforma',
        email:        DONO_EMAIL,
        passwordHash,
        isSuperAdmin: true,
        filiais:      { create: filialIds.map((filialId) => ({ filialId })) },
      },
    });
    console.log(`✅ Dono criado: ${dono.nome} (${DONO_EMAIL}) — senha: ${DONO_SENHA} · super-admin`);
  } else {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: { passwordHash, isSuperAdmin: true, nome: 'Dono da Plataforma' },
    });
    console.log(`ℹ️  Dono já existia: atualizado (${DONO_EMAIL}) — senha: ${DONO_SENHA} · super-admin`);
  }

  // ── 5. Rebaixa o admin@mercado.com (mantém os conceitos limpos) ─
  if (admin?.isSuperAdmin) {
    await prisma.usuario.update({ where: { id: admin.id }, data: { isSuperAdmin: false } });
    console.log(`ℹ️  ${ADMIN_EMAIL} deixou de ser super-admin (agora é só ADMIN da loja).`);
  } else {
    console.log(`ℹ️  ${ADMIN_EMAIL} já não é super-admin (ok).`);
  }

  console.log('\n🎉 Pronto!');
  console.log('─────────────────────────────────────');
  console.log('👑 Acesso do DONO DA PLATAFORMA:');
  console.log(`   ${DONO_EMAIL}  /  ${DONO_SENHA}  →  vai direto para /plataforma`);
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Erro no seed do dono:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
