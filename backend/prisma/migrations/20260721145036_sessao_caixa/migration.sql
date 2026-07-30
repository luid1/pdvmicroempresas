-- CreateEnum
CREATE TYPE "StatusSessaoCaixa" AS ENUM ('ABERTA', 'FECHADA');

-- CreateEnum
CREATE TYPE "TipoMovimentoSessao" AS ENUM ('ABERTURA', 'VENDA', 'SANGRIA', 'SUPRIMENTO');

-- CreateTable
CREATE TABLE "SessaoCaixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "operadorNome" TEXT,
    "status" "StatusSessaoCaixa" NOT NULL DEFAULT 'ABERTA',
    "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDinheiro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCartao" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPix" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSangria" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSuprimento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qtdVendas" INTEGER NOT NULL DEFAULT 0,
    "saldoFinalCalculado" DECIMAL(12,2),
    "saldoFinalInformado" DECIMAL(12,2),
    "diferenca" DECIMAL(12,2),
    "observacoesAbertura" TEXT,
    "observacoesFechamento" TEXT,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoSessao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "tipo" "TipoMovimentoSessao" NOT NULL,
    "formaPagamento" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "pedidoId" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoSessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessaoCaixa_tenantId_status_idx" ON "SessaoCaixa"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SessaoCaixa_tenantId_filialId_status_idx" ON "SessaoCaixa"("tenantId", "filialId", "status");

-- CreateIndex
CREATE INDEX "SessaoCaixa_tenantId_operadorId_status_idx" ON "SessaoCaixa"("tenantId", "operadorId", "status");

-- CreateIndex
CREATE INDEX "MovimentoSessao_sessaoId_idx" ON "MovimentoSessao"("sessaoId");

-- CreateIndex
CREATE INDEX "MovimentoSessao_tenantId_idx" ON "MovimentoSessao"("tenantId");

-- AddForeignKey
ALTER TABLE "MovimentoSessao" ADD CONSTRAINT "MovimentoSessao_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoCaixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

