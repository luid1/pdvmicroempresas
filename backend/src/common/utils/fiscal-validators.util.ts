/**
 * Validadores fiscais brasileiros (Frente F.1b).
 *
 * Validações baratas que evitam rejeição da SEFAZ antes de qualquer transmissão:
 *  - dígito verificador de CNPJ e CPF;
 *  - Inscrição Estadual por UF (algoritmo por estado, com fallback tolerante);
 *  - formato de NCM (8 díg.), CEST (7 díg.), CFOP (4 díg.) e EAN-8/13/14 (checksum).
 *
 * Todas as funções são puras e defensivas: entrada nula/indefinida → false.
 */

const soDigitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

// ─────────────────────────────────────────
// CNPJ / CPF
// ─────────────────────────────────────────

/** Valida CPF pelo dígito verificador (11 dígitos). */
export function validarCpf(valor: unknown): boolean {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calcDV = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dv1 = calcDV(cpf.slice(0, 9), 10);
  if (dv1 !== Number(cpf[9])) return false;
  const dv2 = calcDV(cpf.slice(0, 10), 11);
  return dv2 === Number(cpf[10]);
}

/** Valida CNPJ pelo dígito verificador (14 dígitos). */
export function validarCnpj(valor: unknown): boolean {
  const cnpj = soDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos iguais

  const calcDV = (base: string): number => {
    // pesos: começam em 5 (CNPJ base 12) ou 6 (CNPJ base 13), decrescendo até 2, ciclando 9..2
    let peso = base.length - 7;
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcDV(cnpj.slice(0, 12));
  if (dv1 !== Number(cnpj[12])) return false;
  const dv2 = calcDV(cnpj.slice(0, 13));
  return dv2 === Number(cnpj[13]);
}

/** Valida CPF (11 díg.) ou CNPJ (14 díg.) conforme o tamanho. */
export function validarCnpjCpf(valor: unknown): boolean {
  const d = soDigitos(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

// ─────────────────────────────────────────
// Inscrição Estadual (por UF)
// ─────────────────────────────────────────

/**
 * Valida a IE por estado. "ISENTO" é aceito (contribuinte isento).
 * Para as UFs com algoritmo implementado abaixo, checa o(s) dígito(s) verificador(es);
 * para as demais, valida apenas o intervalo de tamanho esperado (tolerante).
 */
export function validarIE(valor: unknown, uf: unknown): boolean {
  const ie = soDigitos(valor);
  const est = String(uf ?? '').toUpperCase().trim();
  if (String(valor ?? '').toUpperCase().trim() === 'ISENTO') return true;
  if (!ie) return false;

  const modulo11 = (base: string, pesos: number[]): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  switch (est) {
    case 'SP': {
      // Formato industrial: 12 dígitos (ignora o formato P- de produtor rural).
      if (ie.length !== 12) return false;
      const d1 = (() => {
        const pesos = [1, 3, 4, 5, 6, 7, 8, 10];
        let soma = 0;
        for (let i = 0; i < 8; i++) soma += Number(ie[i]) * pesos[i];
        return (soma % 11) % 10;
      })();
      if (d1 !== Number(ie[8])) return false;
      const d2 = (() => {
        const pesos = [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2];
        let soma = 0;
        for (let i = 0; i < 11; i++) soma += Number(ie[i]) * pesos[i];
        return (soma % 11) % 10;
      })();
      return d2 === Number(ie[11]);
    }
    case 'RJ': {
      if (ie.length !== 8) return false;
      const dv = modulo11(ie.slice(0, 7), [2, 7, 6, 5, 4, 3, 2]);
      return dv === Number(ie[7]);
    }
    case 'MG': {
      // 13 dígitos, algoritmo próprio (dois DV).
      if (ie.length !== 13) return false;
      // DV1: insere "0" após os 3 primeiros e aplica pesos 1,2,1,2...; soma dos algarismos.
      const corpo = ie.slice(0, 11);
      const expandido = corpo.slice(0, 3) + '0' + corpo.slice(3);
      let soma1 = 0;
      for (let i = 0; i < expandido.length; i++) {
        const p = i % 2 === 0 ? 1 : 2;
        const prod = Number(expandido[i]) * p;
        soma1 += prod > 9 ? prod - 9 : prod;
      }
      const d1 = (Math.ceil(soma1 / 10) * 10 - soma1) % 10;
      if (d1 !== Number(ie[11])) return false;
      const d2 = modulo11(ie.slice(0, 12), [3, 2, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
      return d2 === Number(ie[12]);
    }
    case 'PR': {
      if (ie.length !== 10) return false;
      const d1 = modulo11(ie.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
      if (d1 !== Number(ie[8])) return false;
      const d2 = modulo11(ie.slice(0, 9), [4, 3, 2, 7, 6, 5, 4, 3, 2]);
      return d2 === Number(ie[9]);
    }
    case 'RS': {
      if (ie.length !== 10) return false;
      const dv = modulo11(ie.slice(0, 9), [2, 9, 8, 7, 6, 5, 4, 3, 2]);
      return dv === Number(ie[9]);
    }
    case 'SC':
    case 'BA':
    case 'GO':
    case 'ES':
    case 'DF':
    case 'MT':
    case 'MS':
      // UFs comuns na operação — checagem de tamanho (9 díg., exceto BA 8-9 / GO 9 / MT 11).
      return ie.length >= 8 && ie.length <= 11;
    default:
      // Fallback tolerante para as demais UFs: 8 a 14 dígitos.
      return ie.length >= 8 && ie.length <= 14;
  }
}

// ─────────────────────────────────────────
// Formatos (NCM, CEST, CFOP, EAN)
// ─────────────────────────────────────────

/** NCM válido = exatamente 8 dígitos numéricos. */
export function validarNcm(valor: unknown): boolean {
  return /^\d{8}$/.test(soDigitos(valor));
}

/** CEST válido = exatamente 7 dígitos numéricos. */
export function validarCest(valor: unknown): boolean {
  return /^\d{7}$/.test(soDigitos(valor));
}

/** CFOP válido = 4 dígitos, primeiro dígito 1-7 (entradas 1/2/3, saídas 5/6/7). */
export function validarCfop(valor: unknown): boolean {
  const c = soDigitos(valor);
  return /^[1-7]\d{3}$/.test(c);
}

/**
 * Valida código de barras GTIN/EAN (8, 12, 13 ou 14 dígitos) pelo dígito verificador.
 * "SEM GTIN" é aceito (produtos sem código de barras usam esse literal na NF-e).
 */
export function validarEan(valor: unknown): boolean {
  const raw = String(valor ?? '').toUpperCase().trim();
  if (!raw || raw === 'SEM GTIN') return true;
  const ean = soDigitos(valor);
  if (![8, 12, 13, 14].includes(ean.length)) return false;
  const digitos = ean.split('').map(Number);
  const dv = digitos.pop() as number;
  // pesos alternados 3/1 da direita para a esquerda
  let soma = 0;
  for (let i = digitos.length - 1, mult = 3; i >= 0; i--, mult = mult === 3 ? 1 : 3) {
    soma += digitos[i] * mult;
  }
  const dvCalc = (10 - (soma % 10)) % 10;
  return dvCalc === dv;
}

/**
 * Classifica um código como CST (regime normal) ou CSOSN (Simples Nacional) do ICMS.
 * CST tem 2 ou 3 dígitos (com origem: "000".."090"); CSOSN tem 3 dígitos iniciando em 1/2/3/4/5/9.
 */
export function isCsosn(codigo: unknown): boolean {
  const c = soDigitos(codigo);
  return ['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'].includes(c);
}

/** CST de ICMS válido (regime normal). */
export function isCstIcms(codigo: unknown): boolean {
  const c = soDigitos(codigo).replace(/^0+(?=\d\d)/, ''); // tolera zero de origem à esquerda
  return ['00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90'].includes(c.slice(-2));
}
