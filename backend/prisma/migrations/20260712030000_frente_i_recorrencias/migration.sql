-- CreateEnum
CREATE TYPE "PeriodicidadeRecorrencia" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateTable
CREATE TABLE "DespesaRecorrente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "fornecedorId" TEXT,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorVariavel" BOOLEAN NOT NULL DEFAULT false,
    "planoContasCodigo" TEXT,
    "diaVencimento" INTEGER NOT NULL DEFAULT 1,
    "periodicidade" "PeriodicidadeRecorrencia" NOT NULL DEFAULT 'MENSAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "proximaGeracao" TIMESTAMP(3) NOT NULL,
    "ultimaGeracao" TIMESTAMP(3),
    "ultimoPeriodoGerado" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaRecorrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DespesaRecorrente_tenantId_idx" ON "DespesaRecorrente"("tenantId");

-- CreateIndex
CREATE INDEX "DespesaRecorrente_ativo_proximaGeracao_idx" ON "DespesaRecorrente"("ativo", "proximaGeracao");

