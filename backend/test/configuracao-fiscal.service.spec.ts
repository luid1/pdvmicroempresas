import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ConfiguracaoFiscalService } from '../src/modules/nfe/configuracao-fiscal.service';

const chaveAnterior = process.env.FISCAL_ENC_KEY;
const chaveCertAnterior = process.env.CERT_ENC_KEY;
afterEach(() => {
  if (chaveAnterior === undefined) delete process.env.FISCAL_ENC_KEY; else process.env.FISCAL_ENC_KEY = chaveAnterior;
  if (chaveCertAnterior === undefined) delete process.env.CERT_ENC_KEY; else process.env.CERT_ENC_KEY = chaveCertAnterior;
});

const filial = { id: 'filial-1', tenantId: 'tenant-1', codigo: '1001', nome: 'Matriz', cnpj: '12345678000190', ie: '123', crt: '1' };

test('credencial fiscal é cifrada e nunca retorna pela API', async () => {
  process.env.FISCAL_ENC_KEY = 'chave-fiscal-de-teste-com-mais-de-16';
  let persistido: any;
  const prisma: any = {
    filial: { findFirst: async () => filial },
    configuracaoFiscal: {
      findUnique: async () => null,
      create: async ({ data }: any) => { persistido = { id: 'cfg-1', ...data }; return persistido; },
    },
  };
  const service = new ConfiguracaoFiscalService(prisma);
  const resposta: any = await service.salvar('tenant-1', 'filial-1', {
    provedor: 'FOCUS_NFE', ambiente: 'HOMOLOGACAO', ativo: false, token: 'token-super-secreto',
  } as any);
  assert.notEqual(persistido.tokenCriptografado, 'token-super-secreto');
  assert.equal(resposta.tokenConfigurado, true);
  assert.equal('tokenCriptografado' in resposta, false);
  assert.equal('token' in resposta, false);
});

test('não salva token sem chave de criptografia', async () => {
  delete process.env.FISCAL_ENC_KEY;
  delete process.env.CERT_ENC_KEY;
  const prisma: any = {
    filial: { findFirst: async () => filial },
    configuracaoFiscal: { findUnique: async () => null },
  };
  const service = new ConfiguracaoFiscalService(prisma);
  await assert.rejects(() => service.salvar('tenant-1', 'filial-1', {
    provedor: 'FOCUS_NFE', ambiente: 'HOMOLOGACAO', ativo: false, token: 'segredo',
  } as any), /FISCAL_ENC_KEY/);
});
