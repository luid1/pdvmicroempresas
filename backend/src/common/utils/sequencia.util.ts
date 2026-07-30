import { Prisma } from '@prisma/client';

/**
 * Gera o próximo número sequencial de forma ATÔMICA (sem corrida).
 *
 * Usa um UPSERT com `RETURNING` na tabela `sequencias`: o incremento acontece
 * dentro de um único comando SQL, então duas emissões simultâneas nunca recebem
 * o mesmo número (ao contrário do padrão `findFirst(orderBy numero desc) + 1`).
 *
 * `seed` é usado apenas na PRIMEIRA vez que o escopo aparece — serve para
 * alinhar o contador ao maior número já existente no domínio (dados legados),
 * de modo que o primeiro número gerado seja `seed + 1`.
 *
 * @param db      PrismaService ou um TransactionClient (use o `tx` quando dentro de $transaction)
 * @param tenantId escopo do tenant
 * @param escopo  chave do contador, ex: "pedido", "oc", "romaneio:<filialId>", "nfe:<serie>"
 * @param seed    valor base para inicialização (default 0 → primeiro número = 1)
 */
export async function proximoNumero(
  db: Prisma.TransactionClient,
  tenantId: string,
  escopo: string,
  seed = 0,
): Promise<number> {
  const rows = await db.$queryRaw<{ valor: number }[]>`
    INSERT INTO sequencias ("tenantId", escopo, valor)
    VALUES (${tenantId}, ${escopo}, ${seed + 1})
    ON CONFLICT ("tenantId", escopo)
    DO UPDATE SET valor = sequencias.valor + 1
    RETURNING valor;
  `;
  return Number(rows[0].valor);
}
