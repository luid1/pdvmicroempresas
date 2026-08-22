-- Módulo R: Operação de Restaurante (mesas, comandas e KDS/cozinha).
-- Migração 100% ADITIVA: apenas cria enums, tabelas e índices novos, com FKs
-- restritas às novas tabelas. Não altera nenhuma tabela existente.

-- CreateEnum
CREATE TYPE "StatusMesa" AS ENUM ('LIVRE', 'OCUPADA', 'CONTA', 'RESERVADA');

-- CreateEnum
CREATE TYPE "OrigemComanda" AS ENUM ('MESA', 'BALCAO', 'DELIVERY');

-- CreateEnum
CREATE TYPE "StatusComanda" AS ENUM ('ABERTA', 'FECHANDO', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EtapaKds" AS ENUM ('FILA', 'PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "apelido" TEXT,
    "lugares" INTEGER NOT NULL DEFAULT 4,
    "status" "StatusMesa" NOT NULL DEFAULT 'LIVRE',
    "posX" INTEGER,
    "posY" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comanda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "mesaId" TEXT,
    "numero" INTEGER NOT NULL,
    "origem" "OrigemComanda" NOT NULL DEFAULT 'MESA',
    "status" "StatusComanda" NOT NULL DEFAULT 'ABERTA',
    "clienteNome" TEXT,
    "pessoas" INTEGER NOT NULL DEFAULT 1,
    "garcomId" TEXT,
    "garcomNome" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxaServico" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "formaPagamento" TEXT,
    "observacoes" TEXT,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemComanda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitario" DECIMAL(12,2) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "observacao" TEXT,
    "etapaKds" "EtapaKds" NOT NULL DEFAULT 'FILA',
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etapaAtualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemComanda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_tenantId_filialId_numero_key" ON "Mesa"("tenantId", "filialId", "numero");

-- CreateIndex
CREATE INDEX "Mesa_tenantId_filialId_status_idx" ON "Mesa"("tenantId", "filialId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Comanda_tenantId_filialId_numero_key" ON "Comanda"("tenantId", "filialId", "numero");

-- CreateIndex
CREATE INDEX "Comanda_tenantId_filialId_status_idx" ON "Comanda"("tenantId", "filialId", "status");

-- CreateIndex
CREATE INDEX "Comanda_mesaId_idx" ON "Comanda"("mesaId");

-- CreateIndex
CREATE INDEX "ItemComanda_comandaId_idx" ON "ItemComanda"("comandaId");

-- CreateIndex
CREATE INDEX "ItemComanda_tenantId_etapaKds_idx" ON "ItemComanda"("tenantId", "etapaKds");

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemComanda" ADD CONSTRAINT "ItemComanda_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
