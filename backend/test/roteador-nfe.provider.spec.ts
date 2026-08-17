import assert from 'node:assert/strict';
import test from 'node:test';
import { RoteadorNfeProvider } from '../src/modules/nfe/providers/roteador.provider';

const resultado = (origem: string) => ({ chaveAcesso: origem, protocolo: origem, xml: origem, danfeUrl: origem, simulacao: origem === 'mock' });

test('roteador escolhe transmissão real por filial ativa', async () => {
  const config: any = { deveTransmitir: async () => true, possuiCredencial: async () => true };
  const mock: any = { autorizar: async () => resultado('mock') };
  const real: any = { autorizar: async () => resultado('real') };
  const roteador = new RoteadorNfeProvider(config, mock, real);
  assert.equal((await roteador.autorizar({ tenantId: 't1', filialId: 'f1' })).chaveAcesso, 'real');
});

test('roteador mantém simulação quando configuração da filial está inativa', async () => {
  const config: any = { deveTransmitir: async () => false, possuiCredencial: async () => false };
  const mock: any = { autorizar: async () => resultado('mock') };
  const real: any = { autorizar: async () => resultado('real') };
  const roteador = new RoteadorNfeProvider(config, mock, real);
  assert.equal((await roteador.autorizar({ tenantId: 't1', filialId: 'f1' })).chaveAcesso, 'mock');
});
