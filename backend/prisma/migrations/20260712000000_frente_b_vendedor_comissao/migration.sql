-- CreateEnum
CREATE TYPE "StatusComissao" AS ENUM ('PENDENTE', 'FECHADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "percentualComissao" DECIMAL(5,2),
ADD COLUMN     "vendedorId" TEXT;

-- CreateTable
CREATE TABLE "Vendedor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "fornecedorId" TEXT,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "percentualPadrao" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "vendedorId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "nfeId" TEXT,
    "descricao" TEXT NOT NULL,
    "baseCalculo" DECIMAL(12,2) NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "status" "StatusComissao" NOT NULL DEFAULT 'PENDENTE',
    "contaPagarId" TEXT,
    "competencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFechamento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendedor_tenantId_idx" ON "Vendedor"("tenantId");

-- CreateIndex
CREATE INDEX "Comissao_tenantId_status_idx" ON "Comissao"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Comissao_vendedorId_idx" ON "Comissao"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Comissao_tenantId_nfeId_vendedorId_key" ON "Comissao"("tenantId", "nfeId", "vendedorId");

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

