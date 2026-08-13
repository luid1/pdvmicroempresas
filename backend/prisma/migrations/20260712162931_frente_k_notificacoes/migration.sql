-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('TITULO_A_RECEBER', 'TITULO_A_PAGAR', 'ESTOQUE_MINIMO', 'VALIDADE_PROXIMA', 'NFE_REJEITADA', 'PEDIDO_BLOQUEADO', 'GENERICO');

-- CreateEnum
CREATE TYPE "SeveridadeNotificacao" AS ENUM ('INFO', 'AVISO', 'CRITICO');

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "usuarioId" TEXT,
    "permissao" TEXT,
    "tipo" "TipoNotificacao" NOT NULL DEFAULT 'GENERICO',
    "severidade" "SeveridadeNotificacao" NOT NULL DEFAULT 'INFO',
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "chaveDedup" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_tenantId_usuarioId_lida_idx" ON "notificacoes"("tenantId", "usuarioId", "lida");

-- CreateIndex
CREATE INDEX "notificacoes_tenantId_createdAt_idx" ON "notificacoes"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_tenantId_chaveDedup_key" ON "notificacoes"("tenantId", "chaveDedup");

