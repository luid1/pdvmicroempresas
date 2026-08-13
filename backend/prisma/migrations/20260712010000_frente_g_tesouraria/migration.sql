-- CreateEnum
CREATE TYPE "TipoContaFinanceira" AS ENUM ('CAIXA', 'BANCO', 'CARTAO', 'APLICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemMovimento" AS ENUM ('BAIXA_RECEBER', 'BAIXA_PAGAR', 'AVULSO', 'TRANSFERENCIA', 'AJUSTE');

-- CreateTable
CREATE TABLE "ContaFinanceira" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL DEFAULT 'BANCO',
    "banco" TEXT,
    "agencia" TEXT,
    "numero" TEXT,
    "documento" TEXT,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldoAtual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoCaixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "contaId" TEXT NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "origem" "OrigemMovimento" NOT NULL DEFAULT 'AVULSO',
    "valor" DECIMAL(14,2) NOT NULL,
    "saldoApos" DECIMAL(14,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "planoContasCodigo" TEXT,
    "contaReceberId" TEXT,
    "contaPagarId" TEXT,
    "transferenciaId" TEXT,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "itemExtratoId" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtratoBancario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "arquivo" TEXT,
    "saldoFinal" DECIMAL(14,2),
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "ExtratoBancario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemExtrato" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extratoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "documento" TEXT,
    "fitId" TEXT,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "movimentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaFinanceira_tenantId_idx" ON "ContaFinanceira"("tenantId");

-- CreateIndex
CREATE INDEX "ContaFinanceira_tenantId_ativo_idx" ON "ContaFinanceira"("tenantId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoCaixa_itemExtratoId_key" ON "MovimentoCaixa"("itemExtratoId");

-- CreateIndex
CREATE INDEX "MovimentoCaixa_tenantId_contaId_data_idx" ON "MovimentoCaixa"("tenantId", "contaId", "data");

-- CreateIndex
CREATE INDEX "MovimentoCaixa_tenantId_origem_idx" ON "MovimentoCaixa"("tenantId", "origem");

-- CreateIndex
CREATE INDEX "MovimentoCaixa_contaReceberId_idx" ON "MovimentoCaixa"("contaReceberId");

-- CreateIndex
CREATE INDEX "MovimentoCaixa_contaPagarId_idx" ON "MovimentoCaixa"("contaPagarId");

-- CreateIndex
CREATE INDEX "MovimentoCaixa_transferenciaId_idx" ON "MovimentoCaixa"("transferenciaId");

-- CreateIndex
CREATE INDEX "ExtratoBancario_tenantId_contaId_idx" ON "ExtratoBancario"("tenantId", "contaId");

-- CreateIndex
CREATE INDEX "ItemExtrato_tenantId_extratoId_idx" ON "ItemExtrato"("tenantId", "extratoId");

-- CreateIndex
CREATE INDEX "ItemExtrato_tenantId_conciliado_idx" ON "ItemExtrato"("tenantId", "conciliado");

-- CreateIndex
CREATE UNIQUE INDEX "ItemExtrato_tenantId_extratoId_fitId_key" ON "ItemExtrato"("tenantId", "extratoId", "fitId");

-- AddForeignKey
ALTER TABLE "MovimentoCaixa" ADD CONSTRAINT "MovimentoCaixa_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtratoBancario" ADD CONSTRAINT "ExtratoBancario_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemExtrato" ADD CONSTRAINT "ItemExtrato_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "ExtratoBancario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

