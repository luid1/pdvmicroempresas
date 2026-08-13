-- Remoção da camada fiscal órfã "Invoice" (Rodada 3), duplicada pelo modelo NFe.
-- Nenhuma tela/fluxo real usa; o faturamento real passa por NFe.
DROP TABLE IF EXISTS "invoice_audit_logs" CASCADE;
DROP TABLE IF EXISTS "invoice_taxes" CASCADE;
DROP TABLE IF EXISTS "invoices" CASCADE;
DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "TaxType";
