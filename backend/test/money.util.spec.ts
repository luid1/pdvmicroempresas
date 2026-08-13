import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toNumber, toCents, fromCents, money, sumMoney, subMoney,
  assertValorPositivo, ratearParcelas,
} from '../src/common/utils/money.util';

test('toNumber: normaliza nulo, string com vírgula e lixo', () => {
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber('1,50'), 1.5);
  assert.equal(toNumber('abc'), 0);
  assert.equal(toNumber(2.5), 2.5);
});

test('sumMoney: soma sem drift de float (0.1 + 0.2 === 0.3)', () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(sumMoney([10.001, 0.001]), 10.0); // arredonda cada valor a centavo antes de somar
});

test('subMoney: nunca retorna -0 e é exato em centavos', () => {
  assert.equal(subMoney(0, 0), 0);
  assert.equal(Object.is(subMoney(0, 0), -0), false);
  assert.equal(subMoney(1.0, 0.9), 0.1);
});

test('toCents/fromCents: ida e volta preserva centavos', () => {
  assert.equal(toCents(12.34), 1234);
  assert.equal(fromCents(1234), 12.34);
  assert.equal(money(3.005), 3.01);
});

test('assertValorPositivo: lança para <= 0 e devolve o valor normalizado', () => {
  assert.equal(assertValorPositivo('9,99'), 9.99);
  assert.throws(() => assertValorPositivo(0));
  assert.throws(() => assertValorPositivo(-5));
});

test('ratearParcelas: soma das parcelas === total exato', () => {
  const p = ratearParcelas(100, 3);
  assert.equal(p.length, 3);
  assert.equal(sumMoney(p), 100);
  // sobra do arredondamento vai nas primeiras parcelas
  assert.deepEqual(p, [33.34, 33.33, 33.33]);
});
