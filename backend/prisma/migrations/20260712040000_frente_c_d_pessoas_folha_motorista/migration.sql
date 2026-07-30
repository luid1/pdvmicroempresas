-- CreateEnum
CREATE TYPE "StatusFuncionario" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "StatusFolha" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoItemFolha" AS ENUM ('PROVENTO', 'DESCONTO');

-- CreateEnum
CREATE TYPE "StatusPagamentoMotorista" AS ENUM ('PENDENTE', 'A_PAGAR', 'CANCELADO');

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "cargo" TEXT,
    "departamento" TEXT,
    "salarioBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dataAdmissao" TIMESTAMP(3),
    "dataDesligamento" TIMESTAMP(3),
    "status" "StatusFuncionario" NOT NULL DEFAULT 'ATIVO',
    "chavePix" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folha" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "competencia" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusFolha" NOT NULL DEFAULT 'ABERTA',
    "dataPagamento" TIMESTAMP(3),
    "totalProventos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDescontos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalLiquido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fechadaEm" TIMESTAMP(3),
    "fechadaPor" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFolha" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folhaId" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoItemFolha" NOT NULL DEFAULT 'PROVENTO',
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "contaPagarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemFolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoMotorista" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filialId" TEXT,
    "routeId" TEXT,
    "motoristaId" TEXT,
    "motoristaNome" TEXT,
    "funcionarioId" TEXT,
    "fornecedorId" TEXT,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "status" "StatusPagamentoMotorista" NOT NULL DEFAULT 'PENDENTE',
    "contaPagarId" TEXT,
    "planoContasCodigo" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagamentoMotorista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Funcionario_tenantId_status_idx" ON "Funcionario"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Funcionario_tenantId_filialId_idx" ON "Funcionario"("tenantId", "filialId");

-- CreateIndex
CREATE INDEX "Folha_tenantId_status_idx" ON "Folha"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Folha_tenantId_competencia_key" ON "Folha"("tenantId", "competencia");

-- CreateIndex
CREATE INDEX "ItemFolha_tenantId_folhaId_idx" ON "ItemFolha"("tenantId", "folhaId");

-- CreateIndex
CREATE INDEX "ItemFolha_funcionarioId_idx" ON "ItemFolha"("funcionarioId");

-- CreateIndex
CREATE INDEX "PagamentoMotorista_tenantId_status_idx" ON "PagamentoMotorista"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PagamentoMotorista_tenantId_motoristaId_idx" ON "PagamentoMotorista"("tenantId", "motoristaId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoMotorista_tenantId_routeId_key" ON "PagamentoMotorista"("tenantId", "routeId");

-- AddForeignKey
ALTER TABLE "ItemFolha" ADD CONSTRAINT "ItemFolha_folhaId_fkey" FOREIGN KEY ("folhaId") REFERENCES "Folha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFolha" ADD CONSTRAINT "ItemFolha_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

