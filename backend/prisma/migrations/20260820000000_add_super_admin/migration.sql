-- Dono da plataforma (SaaS): usuário com acesso ao painel cross-tenant.
ALTER TABLE "Usuario" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
