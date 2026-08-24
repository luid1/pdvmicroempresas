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

// Bancos serverless (ex.: Neon free tier) suspendem por ociosidade. A primeira
// conexão pode falhar com P1001 enquanto o compute "acorda". Como abrimos uma
// conexão nova por migration, esses cold-starts são comuns — então cada passo
// tem retry com espera curta antes de desistir.
const MAX_TENTATIVAS = 8;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Transitório = vale a pena tentar de novo:
//  • P1001 / "Can't reach" → compute do Neon acordando (cold-start).
//  • P1002 / advisory lock → sessão zumbi ainda segurando o lock; o Neon libera
//    em alguns segundos.
const ehTransitorio = (s) =>
  /P1001|P1002|Can't reach database server|ETIMEDOUT|ECONNRESET|Timed out|advisory lock/i.test(s);
const ehJaRegistrada = (s) => /already recorded|already applied|P3008/i.test(s);

let marcadas = 0;
let puladas = 0;
for (const nome of migrations) {
  let ok = false;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS && !ok; tentativa++) {
    try {
      execSync(`npx prisma migrate resolve --applied ${nome}`, { stdio: 'pipe' });
      console.log(`  ✓ marcada como aplicada: ${nome}`);
      marcadas++;
      ok = true;
    } catch (e) {
      const saida = `${e.stdout || ''}${e.stderr || ''}`;
      if (ehJaRegistrada(saida)) {
        console.log(`  • já estava registrada: ${nome}`);
        puladas++;
        ok = true;
      } else if (ehTransitorio(saida) && tentativa < MAX_TENTATIVAS) {
        const s = Math.min(3000 * tentativa, 15000);
        console.log(`  … banco indisponível/lock ocupado, tentando de novo em ${s / 1000}s [${tentativa}/${MAX_TENTATIVAS}]: ${nome}`);
        await espera(s);
      } else {
        console.error(`  ✖ falhou em ${nome}:\n${saida}`);
        process.exit(1);
      }
    }
  }
}

console.log(`\n✔ Baseline concluído — ${marcadas} marcadas, ${puladas} já registradas.`);
console.log('  Agora o deploy pode usar `prisma migrate deploy` com segurança.');
