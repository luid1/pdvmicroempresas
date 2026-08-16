CREATE TYPE "StatusTransferenciaEstoque" AS ENUM (
  'RASCUNHO', 'SOLICITADA', 'APROVADA', 'EM_TRANSITO',
  'RECEBIDA', 'RECEBIDA_COM_DIVERGENCIA', 'CANCELADA'
);

ALTER TABLE "Produto"
  ADD COLUMN "skuFornecedor" TEXT,
  ADD COLUMN "gtinTributavel" TEXT,
  ADD COLUMN "codigoBarrasCaixa" TEXT,
  ADD COLUMN "referencia" TEXT,
  ADD COLUMN "fabricante" TEXT,
  ADD COLUMN "descricaoFiscal" TEXT,
  ADD COLUMN "exTipi" TEXT,
  ADD COLUMN "codigoBeneficioFiscal" TEXT,
  ADD COLUMN "generoItem" TEXT,
  ADD COLUMN "cstIbsCbs" TEXT,
  ADD COLUMN "classTribIbsCbs" TEXT,
  ADD COLUMN "aliquotaIbsUf" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaIbsMun" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaCbs" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "alturaCm" DECIMAL(10,2),
  ADD COLUMN "larguraCm" DECIMAL(10,2),
  ADD COLUMN "comprimentoCm" DECIMAL(10,2),
  ADD COLUMN "quantidadeEmbalagem" DECIMAL(12,4) NOT NULL DEFAULT 1,
  ADD COLUMN "multiploCompra" DECIMAL(12,4) NOT NULL DEFAULT 1,
  ADD COLUMN "estoqueSeguranca" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "pontoReposicao" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "leadTimeDias" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "localizacaoPadrao" TEXT;

ALTER TABLE "NFe"
  ADD COLUMN "destInscricaoEstadual" TEXT,
  ADD COLUMN "indicadorIeDestinatario" INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN "consumidorFinal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "presencaComprador" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "valorIbs" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "valorCbs" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "ItemNFe"
  ADD COLUMN "cstIpi" TEXT,
  ADD COLUMN "baseCalcIpi" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaIpi" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "valorIpi" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cstIbsCbs" TEXT,
  ADD COLUMN "classTribIbsCbs" TEXT,
  ADD COLUMN "baseCalcIbsCbs" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaIbsUf" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "valorIbsUf" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaIbsMun" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "valorIbsMun" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "aliquotaCbs" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "valorCbs" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX "Produto_tenantId_codigoBarrasCaixa_idx" ON "Produto"("tenantId", "codigoBarrasCaixa");
CREATE INDEX "Produto_tenantId_skuFornecedor_idx" ON "Produto"("tenantId", "skuFornecedor");

CREATE TABLE "TransferenciaEstoque" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "filialOrigemId" TEXT NOT NULL,
  "filialDestinoId" TEXT NOT NULL,
  "status" "StatusTransferenciaEstoque" NOT NULL DEFAULT 'RASCUNHO',
  "observacoes" TEXT,
  "motivoCancelamento" TEXT,
  "usuarioSolicitanteId" TEXT NOT NULL,
  "usuarioAprovadorId" TEXT,
  "usuarioDespachoId" TEXT,
  "usuarioRecebimentoId" TEXT,
  "solicitadaEm" TIMESTAMP(3),
  "aprovadaEm" TIMESTAMP(3),
  "despachadaEm" TIMESTAMP(3),
  "recebidaEm" TIMESTAMP(3),
  "canceladaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransferenciaEstoque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemTransferenciaEstoque" (
  "id" TEXT NOT NULL,
  "transferenciaId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "loteId" TEXT,
  "localizacaoOrigemId" TEXT,
  "quantidadeSolicitada" DECIMAL(12,4) NOT NULL,
  "quantidadeDespachada" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "quantidadeRecebida" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "custoUnitario" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "observacaoDivergencia" TEXT,
  CONSTRAINT "ItemTransferenciaEstoque_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "transferenciaId" TEXT;

CREATE UNIQUE INDEX "TransferenciaEstoque_tenantId_codigo_key" ON "TransferenciaEstoque"("tenantId", "codigo");
CREATE INDEX "TransferenciaEstoque_tenantId_filialOrigemId_status_idx" ON "TransferenciaEstoque"("tenantId", "filialOrigemId", "status");
CREATE INDEX "TransferenciaEstoque_tenantId_filialDestinoId_status_idx" ON "TransferenciaEstoque"("tenantId", "filialDestinoId", "status");
CREATE INDEX "ItemTransferenciaEstoque_transferenciaId_idx" ON "ItemTransferenciaEstoque"("transferenciaId");
CREATE INDEX "ItemTransferenciaEstoque_produtoId_idx" ON "ItemTransferenciaEstoque"("produtoId");
CREATE INDEX "MovimentacaoEstoque_transferenciaId_idx" ON "MovimentacaoEstoque"("transferenciaId");

ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_filialOrigemId_fkey" FOREIGN KEY ("filialOrigemId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_filialDestinoId_fkey" FOREIGN KEY ("filialDestinoId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemTransferenciaEstoque" ADD CONSTRAINT "ItemTransferenciaEstoque_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaEstoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemTransferenciaEstoque" ADD CONSTRAINT "ItemTransferenciaEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
