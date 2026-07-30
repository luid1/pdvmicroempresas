-- Numeração sequencial atômica (P1-4): contador por tenant + escopo.
-- Criada originalmente via `prisma db push` no ambiente de dev; esta migration
-- registra a mudança no histórico para que `prisma migrate deploy` reproduza a
-- tabela em ambientes novos (senão `proximoNumero()` quebra em runtime).
CREATE TABLE "sequencias" (
    "tenantId" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequencias_pkey" PRIMARY KEY ("tenantId","escopo")
);
