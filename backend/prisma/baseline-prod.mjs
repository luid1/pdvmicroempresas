/**
 * Baseline de produção — passo ÚNICO para migrar de `prisma db push` para
 * `prisma migrate deploy` num banco que já existe (criado via db push).
 *
 * Contexto: o banco de produção foi sempre sincronizado com `db push`, então a
 * tabela `_prisma_migrations` está VAZIA, mas o schema cumulativo de todas as
 * migrations JÁ está aplicado. Se rodássemos `migrate deploy` direto, o Prisma
 * tentaria recriar tabelas que já existem e falharia.
 *
 * Este script marca TODAS as migrations existentes como "já aplicadas"
 * (resolve --applied), sem executar o SQL. Depois disso, `migrate deploy` passa
 * a aplicar apenas as migrations NOVAS.
 *
 * Como rodar (UMA vez, apontando para o banco de produção):
 *   DATABASE_URL="<connection-string-do-neon>" node prisma/baseline-prod.mjs
 *
 * É seguro rodar novamente: migrations já registradas são puladas.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(aqui, 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('✖ DATABASE_URL não definido. Rode apontando para o banco de produção.');
  process.exit(1);
}

const migrations = readdirSync(migrationsDir)
  .filter((n) => {
    try { return statSync(join(migrationsDir, n)).isDirectory(); } catch { return false; }
  })
  .sort(); // ordem cronológica (prefixo timestamp)

if (migrations.length === 0) {
  console.error('✖ Nenhuma migration encontrada em prisma/migrations.');
  process.exit(1);
}

console.log(`→ Baseline de ${migrations.length} migrations no banco de produção...\n`);

let marcadas = 0;
let puladas = 0;
for (const nome of migrations) {
  try {
    execSync(`npx prisma migrate resolve --applied ${nome}`, { stdio: 'pipe' });
    console.log(`  ✓ marcada como aplicada: ${nome}`);
    marcadas++;
  } catch (e) {
    const saida = `${e.stdout || ''}${e.stderr || ''}`;
    // Já registrada anteriormente → tudo certo, segue.
    if (/already recorded|already applied|P3008/i.test(saida)) {
      console.log(`  • já estava registrada: ${nome}`);
      puladas++;
    } else {
      console.error(`  ✖ falhou em ${nome}:\n${saida}`);
      process.exit(1);
    }
  }
}

console.log(`\n✔ Baseline concluído — ${marcadas} marcadas, ${puladas} já registradas.`);
console.log('  Agora o deploy pode usar `prisma migrate deploy` com segurança.');
