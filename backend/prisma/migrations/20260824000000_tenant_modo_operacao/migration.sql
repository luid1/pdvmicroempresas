-- CreateEnum
CREATE TYPE "ModoOperacao" AS ENUM ('VAREJO', 'RESTAURANTE', 'HIBRIDO');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "modo" "ModoOperacao" NOT NULL DEFAULT 'VAREJO';
