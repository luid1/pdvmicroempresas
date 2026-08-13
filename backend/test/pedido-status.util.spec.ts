import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarTransicaoPedido, TRANSICOES_PEDIDO } from '../src/modules/pedidos/pedido-status.util';

test('transição legítima é aceita', () => {
  assert.deepEqual(avaliarTransicaoPedido('RASCUNHO', 'CONFIRMADO'), { ok: true });
  assert.deepEqual(avaliarTransicaoPedido('SEPARADO', 'FATURADO'), { ok: true });
});

test('pulo de etapa é barrado (P1-3): RASCUNHO → ENTREGUE', () => {
  const r = avaliarTransicaoPedido('RASCUNHO', 'ENTREGUE');
  assert.equal(r.ok, false);
  assert.match((r as any).motivo, /não é permitida/);
});

test('mesmo status é idempotente (ok, sem efeito)', () => {
  assert.deepEqual(avaliarTransicaoPedido('CONFIRMADO', 'CONFIRMADO'), { ok: true, idempotente: true });
});

test('estados terminais não transicionam', () => {
  assert.equal(avaliarTransicaoPedido('CANCELADO', 'CONFIRMADO').ok, false);
  assert.equal(avaliarTransicaoPedido('DEVOLVIDO', 'ENTREGUE').ok, false);
});

test('status atual desconhecido é rejeitado', () => {
  const r = avaliarTransicaoPedido('INEXISTENTE', 'CONFIRMADO');
  assert.equal(r.ok, false);
  assert.match((r as any).motivo, /Status atual inválido/);
});

test('todo destino de transição também é uma chave conhecida (tabela consistente)', () => {
  const chaves = new Set(Object.keys(TRANSICOES_PEDIDO));
  for (const destinos of Object.values(TRANSICOES_PEDIDO)) {
    for (const d of destinos) assert.ok(chaves.has(d), `destino ${d} sem estado definido`);
  }
});
