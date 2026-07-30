-- CreateTable
CREATE TABLE "certificados_digitais" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'A1',
    "arquivo" TEXT NOT NULL,
    "senhaCriptografada" TEXT NOT NULL,
    "cnpj" TEXT,
    "validoDe" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificados_digitais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificados_digitais_tenantId_ativo_idx" ON "certificados_digitais"("tenantId", "ativo");

-- AddForeignKey
ALTER TABLE "certificados_digitais" ADD CONSTRAINT "certificados_digitais_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_digitais" ADD CONSTRAINT "certificados_digitais_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

