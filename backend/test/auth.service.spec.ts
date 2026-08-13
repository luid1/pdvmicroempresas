import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

const criarService = (prisma: Record<string, unknown>, jwt: Record<string, unknown> = {}) =>
  new AuthService(prisma as any, jwt as any);

test('listagem pública de perfis exige empresa vinculada', async () => {
  const service = criarService({});

  await assert.rejects(
    () => service.getUsersForLogin(),
    (erro: unknown) => erro instanceof UnauthorizedException,
  );
});

test('listagem pública não seleciona nem devolve e-mail', async () => {
  let consulta: any;
  const service = criarService({
    usuario: {
      findMany: async (args: any) => {
        consulta = args;
        return [{
          id: 'u1',
          nome: 'Operador',
          pinHash: null,
          role: { nome: 'OPERADOR_CAIXA' },
          ultimoAcesso: null,
        }];
      },
    },
  }, { verify: () => ({ tenantId: 'tenant-1', purpose: 'pair' }) });

  const perfis = await service.getUsersForLogin('pair-token', 'tenant-1');

  assert.equal(consulta.select.email, undefined);
  assert.equal('email' in perfis[0], false);
  assert.equal(perfis[0].temPin, false);
});

test('login por e-mail ambíguo exige identificação da empresa', async () => {
  const service = criarService({
    usuario: {
      findMany: async () => [{ id: 'u1' }, { id: 'u2' }],
    },
  });

  await assert.rejects(
    () => service.login('dono@empresa.com', 'senha'),
    (erro: unknown) =>
      erro instanceof UnauthorizedException &&
      erro.message.includes('mais de uma empresa'),
  );
});
