-- CreateTable
CREATE TABLE "DevolucaoCompra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "entradaId" TEXT,
    "numero" INTEGER NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "contaPagarId" TEXT,
    "usuarioId" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevolucaoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDevolucaoCompra" (
    "id" TEXT NOT NULL,
    "devolucaoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "valorUnitario" DECIMAL(12,4) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "loteId" TEXT,

    CONSTRAINT "ItemDevolucaoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoTabela" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tabela" TEXT NOT NULL,
    "preco" DECIMAL(12,4) NOT NULL,
    "promoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "promoPreco" DECIMAL(12,4),
    "promoInicio" TIMESTAMP(3),
    "promoFim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoTabela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevolucaoCompra_tenantId_createdAt_idx" ON "DevolucaoCompra"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DevolucaoCompra_tenantId_fornecedorId_idx" ON "DevolucaoCompra"("tenantId", "fornecedorId");

-- CreateIndex
CREATE INDEX "DevolucaoCompra_tenantId_entradaId_idx" ON "DevolucaoCompra"("tenantId", "entradaId");

-- CreateIndex
CREATE INDEX "ItemDevolucaoCompra_devolucaoId_idx" ON "ItemDevolucaoCompra"("devolucaoId");

-- CreateIndex
CREATE INDEX "PrecoTabela_tenantId_produtoId_idx" ON "PrecoTabela"("tenantId", "produtoId");

-- CreateIndex
CREATE INDEX "PrecoTabela_tenantId_tabela_idx" ON "PrecoTabela"("tenantId", "tabela");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoTabela_tenantId_produtoId_tabela_key" ON "PrecoTabela"("tenantId", "produtoId", "tabela");

-- AddForeignKey
ALTER TABLE "ItemDevolucaoCompra" ADD CONSTRAINT "ItemDevolucaoCompra_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "DevolucaoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

