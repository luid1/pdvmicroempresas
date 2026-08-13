-- CreateEnum
CREATE TYPE "TipoDocTransporte" AS ENUM ('MDFE', 'CTE');

-- CreateEnum
CREATE TYPE "StatusDocTransporte" AS ENUM ('ABERTO', 'ENCERRADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "documentos_transporte" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "tipo" "TipoDocTransporte" NOT NULL,
    "numero" INTEGER NOT NULL DEFAULT 0,
    "serie" TEXT NOT NULL DEFAULT '1',
    "placa" TEXT NOT NULL,
    "motorista" TEXT,
    "ufIni" TEXT NOT NULL,
    "ufFim" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nfesJson" JSONB,
    "status" "StatusDocTransporte" NOT NULL DEFAULT 'ABERTO',
    "simulacao" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_transporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_transporte_tenantId_filialId_tipo_idx" ON "documentos_transporte"("tenantId", "filialId", "tipo");

-- CreateIndex
CREATE INDEX "documentos_transporte_tenantId_createdAt_idx" ON "documentos_transporte"("tenantId", "createdAt");

