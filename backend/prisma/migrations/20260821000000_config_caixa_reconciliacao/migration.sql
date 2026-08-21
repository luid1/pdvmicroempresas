-- Configuração do CAIXA (PDV) por loja: senha gerencial interna + quais operações exigem senha.
CREATE TABLE "ConfiguracaoCaixa" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "filialId" TEXT NOT NULL,
  "senhaGerencialHash" TEXT,
  "senhaCancelarVenda" BOOLEAN NOT NULL DEFAULT true,
  "senhaRemoverItem" BOOLEAN NOT NULL DEFAULT true,
  "senhaDesconto" BOOLEAN NOT NULL DEFAULT true,
  "senhaSangria" BOOLEAN NOT NULL DEFAULT true,
  "senhaSuprimento" BOOLEAN NOT NULL DEFAULT false,
  "senhaFecharCaixa" BOOLEAN NOT NULL DEFAULT true,
  "senhaEstorno" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfiguracaoCaixa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoCaixa_filialId_key" ON "ConfiguracaoCaixa"("filialId");
CREATE UNIQUE INDEX "ConfiguracaoCaixa_tenantId_filialId_key" ON "ConfiguracaoCaixa"("tenantId", "filialId");
CREATE INDEX "ConfiguracaoCaixa_tenantId_idx" ON "ConfiguracaoCaixa"("tenantId");
ALTER TABLE "ConfiguracaoCaixa" ADD CONSTRAINT "ConfiguracaoCaixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfiguracaoCaixa" ADD CONSTRAINT "ConfiguracaoCaixa_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conferência de cartão/PIX na maquininha ao fechar o caixa.
ALTER TABLE "SessaoCaixa" ADD COLUMN "cartaoInformado" DECIMAL(12,2);
ALTER TABLE "SessaoCaixa" ADD COLUMN "pixInformado" DECIMAL(12,2);
ALTER TABLE "SessaoCaixa" ADD COLUMN "diferencaCartao" DECIMAL(12,2);
ALTER TABLE "SessaoCaixa" ADD COLUMN "diferencaPix" DECIMAL(12,2);
