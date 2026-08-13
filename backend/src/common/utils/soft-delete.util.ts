import { Prisma } from '@prisma/client';

/**
 * Remove um registro-mestre com segurança.
 *
 * Tenta o delete FÍSICO primeiro (mestre sem histórico → some de vez). Se o banco
 * recusar por violação de chave estrangeira (Prisma P2003 — existe pedido/nota/título
 * apontando para o registro), faz SOFT-DELETE (`ativo=false`) para preservar a
 * rastreabilidade em vez de estourar um erro de constraint na cara do usuário.
 *
 * @param hardDelete callback que executa o `prisma.<modelo>.delete(...)`
 * @param softDelete callback que executa o `prisma.<modelo>.update({ data: { ativo: false } })`
 */
export async function removerOuInativar(
  hardDelete: () => Promise<unknown>,
  softDelete: () => Promise<unknown>,
): Promise<{ ok: true; inativado: boolean }> {
  try {
    await hardDelete();
    return { ok: true, inativado: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      await softDelete();
      return { ok: true, inativado: true };
    }
    throw e;
  }
}
