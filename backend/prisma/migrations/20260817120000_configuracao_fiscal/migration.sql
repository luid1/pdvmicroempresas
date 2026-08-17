CREATE TABLE "ConfiguracaoFiscal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "filialId" TEXT NOT NULL,
  "provedor" TEXT NOT NULL DEFAULT 'FOCUS_NFE',
  "ambiente" TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT,
  "tokenCriptografado" TEXT,
  "cscId" TEXT,
  "cscCriptografado" TEXT,
  "serieNfe" TEXT NOT NULL DEFAULT '1',
  "serieNfce" TEXT NOT NULL DEFAULT '1',
  "statusConexao" TEXT NOT NULL DEFAULT 'PENDENTE',
  "mensagemStatus" TEXT,
  "ultimoTesteEm" TIMESTAMP(3),
  "configPublica" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfiguracaoFiscal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoFiscal_filialId_key" ON "ConfiguracaoFiscal"("filialId");
CREATE UNIQUE INDEX "ConfiguracaoFiscal_tenantId_filialId_key" ON "ConfiguracaoFiscal"("tenantId", "filialId");
CREATE INDEX "ConfiguracaoFiscal_tenantId_ativo_idx" ON "ConfiguracaoFiscal"("tenantId", "ativo");
ALTER TABLE "ConfiguracaoFiscal" ADD CONSTRAINT "ConfiguracaoFiscal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfiguracaoFiscal" ADD CONSTRAINT "ConfiguracaoFiscal_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
