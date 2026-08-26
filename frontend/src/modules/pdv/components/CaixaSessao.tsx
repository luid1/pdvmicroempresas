import { useState } from 'react';
import {
  Lock, Unlock, DollarSign, ArrowDownCircle, ArrowUpCircle, X, Check, Loader2, Printer,
} from 'lucide-react';
import { pdvApi } from '../../../services/api';

export const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type SessaoRel = {
  tipo: 'X' | 'Z';
  sessaoId: string;
  status: 'ABERTA' | 'FECHADA';
  operador: string | null;
  abertaEm: string;
  fechadaEm: string | null;
  saldoInicial: number;
  qtdVendas: number;
  totalVendas: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalSangria: number;
  totalSuprimento: number;
  dinheiroEsperadoGaveta: number;
  saldoFinalInformado: number | null;
  diferenca: number | null;
  // Conferência por meio de pagamento (informado no fechamento).
  cartaoInformado: number | null;
  pixInformado: number | null;
  diferencaCartao: number | null;
  diferencaPix: number | null;
};

function extrairMsg(e: any, fallback: string) {
  const msg = e?.response?.data?.message || fallback;
  return Array.isArray(msg) ? msg[0] : msg;
}

// Máscara de moeda para os campos de conferência: o operador digita só os
// números (ex.: 12345) e o campo mostra "123,45" — pontuação bonitinha.
function moedaMask(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 12);
  const cents = digits === '' ? 0 : parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function moedaParaNumero(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 12);
  return digits === '' ? 0 : parseInt(digits, 10) / 100;
}

/** Tela de abertura de caixa — exibida quando não há sessão aberta. */
export function AbrirCaixa({
  filialId,
  onAberta,
}: {
  filialId?: string;
  onAberta: () => void;
}) {
  const [fundo, setFundo] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    if (!filialId) {
      setErro('Nenhuma filial ativa. Refaça o login.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await pdvApi.abrirSessao({
        filialId,
        saldoInicial: parseFloat(fundo.replace(',', '.')) || 0,
        observacoes: obs || undefined,
      });
      onAberta();
    } catch (e: any) {
      setErro(extrairMsg(e, 'Falha ao abrir o caixa.'));
      setSalvando(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] p-6 shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="mb-1 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#01B8FA]/10 ring-1 ring-inset ring-[#01B8FA]/20">
            <Lock className="h-5 w-5 text-[#01B8FA]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-[#F7F8FA]">Caixa fechado</h2>
            <p className="text-xs text-[#8A90A0]">Abra o caixa para começar a vender</p>
          </div>
        </div>
        <p className="mb-5 mt-4 text-sm text-[#8A90A0]">
          Informe o fundo de troco inicial na gaveta para abrir o caixa.
        </p>

        <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Fundo de troco (R$)</label>
        <input
          autoFocus
          value={fundo}
          onChange={(e) => setFundo(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3 text-lg text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Observação (opcional)</label>
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex.: turno da manhã"
          className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-2.5 text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
        />

        {erro && (
          <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">{erro}</div>
        )}

        <button
          onClick={abrir}
          disabled={salvando}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-4 text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
        >
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
          {salvando ? 'Abrindo...' : 'Abrir caixa'}
        </button>
      </div>
    </div>
  );
}

/** Modal genérico para Sangria / Suprimento. */
export function ModalValor({
  titulo,
  cor,
  icon,
  onFechar,
  onConfirmar,
}: {
  titulo: string;
  cor: string;
  icon: JSX.Element;
  onFechar: () => void;
  onConfirmar: (valor: number, descricao: string) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const [valor, setValor] = useState('');
  const [desc, setDesc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorNum = parseFloat(valor.replace(',', '.')) || 0;

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    const res = await onConfirmar(valorNum, desc);
    if (!res.ok) {
      setErro(res.erro || 'Falha ao registrar.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-semibold text-[#F7F8FA]">{titulo}</h2>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Valor (R$)</label>
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3 text-lg text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Motivo (opcional)</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-2.5 text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">{erro}</div>
          )}
          <button
            onClick={confirmar}
            disabled={salvando || valorNum <= 0}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-lg font-semibold text-white shadow-lg transition-all active:scale-[0.99] disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none ${cor}`}
          >
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de fechamento de caixa (conferência por meio de pagamento). */
export function ModalFechar({
  esperado,
  esperadoCartao,
  esperadoPix,
  onFechar,
  onConfirmar,
}: {
  esperado: number;
  esperadoCartao: number;
  esperadoPix: number;
  onFechar: () => void;
  onConfirmar: (dados: {
    dinheiro: number;
    cartao: number;
    pix: number;
    obs: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const [dinheiro, setDinheiro] = useState('');
  const [cartao, setCartao] = useState('');
  const [pix, setPix] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dinheiroNum = moedaParaNumero(dinheiro);
  const cartaoNum = moedaParaNumero(cartao);
  const pixNum = moedaParaNumero(pix);

  const difDinheiro = dinheiroNum - esperado;
  const difCartao = cartaoNum - esperadoCartao;
  const difPix = pixNum - esperadoPix;

  // Conferência global: soma do que foi contado x soma do que era esperado.
  const totalEsperado = esperado + esperadoCartao + esperadoPix;
  const totalContado = dinheiroNum + cartaoNum + pixNum;
  const difTotal = totalContado - totalEsperado;

  async function confirmar() {
    if (dinheiro === '') {
      setErro('Informe o dinheiro contado na gaveta.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const res = await onConfirmar({ dinheiro: dinheiroNum, cartao: cartaoNum, pix: pixNum, obs });
    if (!res.ok) {
      setErro(res.erro || 'Falha ao fechar o caixa.');
      setSalvando(false);
    }
  }

  // Linha de conferência de um meio: rótulo, esperado, campo e diferença.
  const linhaDif = (dif: number, preenchido: boolean) => {
    if (!preenchido) return null;
    const ok = Math.abs(dif) < 0.005;
    return (
      <div
        className={`mt-1 text-right text-xs font-medium ${
          ok ? 'text-[#01B8FA]' : dif > 0 ? 'text-amber-600' : 'text-rose-600'
        }`}
      >
        {ok ? 'Confere' : dif > 0 ? `Sobra ${brl(dif)}` : `Falta ${brl(-dif)}`}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#23262F] bg-[#101216] px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#01B8FA]" />
            <h2 className="text-lg font-semibold text-[#F7F8FA]">Fechar caixa</h2>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {/* Dinheiro na gaveta */}
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Dinheiro contado (R$)</label>
            <span className="text-xs text-[#8A90A0]">Esperado {brl(esperado)}</span>
          </div>
          <input
            autoFocus
            value={dinheiro}
            onChange={(e) => setDinheiro(moedaMask(e.target.value))}
            placeholder="0,00"
            inputMode="numeric"
            className="w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3 text-right text-lg tabular-nums text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          {linhaDif(difDinheiro, dinheiro !== '')}

          {/* Cartão (maquininha) */}
          <div className="mb-1.5 mt-4 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Cartão na maquininha (R$)</label>
            <span className="text-xs text-[#8A90A0]">Esperado {brl(esperadoCartao)}</span>
          </div>
          <input
            value={cartao}
            onChange={(e) => setCartao(moedaMask(e.target.value))}
            placeholder="0,00"
            inputMode="numeric"
            className="w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3 text-right text-lg tabular-nums text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          {linhaDif(difCartao, cartao !== '')}

          {/* PIX */}
          <div className="mb-1.5 mt-4 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">PIX recebido (R$)</label>
            <span className="text-xs text-[#8A90A0]">Esperado {brl(esperadoPix)}</span>
          </div>
          <input
            value={pix}
            onChange={(e) => setPix(moedaMask(e.target.value))}
            placeholder="0,00"
            inputMode="numeric"
            className="w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3 text-right text-lg tabular-nums text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          {linhaDif(difPix, pix !== '')}

          {/* Conferência total */}
          <div className="mt-4 space-y-1 rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#8A90A0]">Total esperado</span>
              <span className="font-semibold tabular-nums text-[#F7F8FA]">{brl(totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8A90A0]">Total contado</span>
              <span className="font-semibold tabular-nums text-[#F7F8FA]">{brl(totalContado)}</span>
            </div>
            <div
              className={`flex justify-between border-t border-[#23262F] pt-1.5 text-sm font-semibold ${
                Math.abs(difTotal) < 0.005 ? 'text-[#01B8FA]' : difTotal > 0 ? 'text-amber-600' : 'text-rose-600'
              }`}
            >
              <span>Diferença</span>
              <span className="tabular-nums">{brl(difTotal)}</span>
            </div>
          </div>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Observação (opcional)</label>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-2.5 text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">{erro}</div>
          )}
          <button
            onClick={confirmar}
            disabled={salvando || dinheiro === ''}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-3.5 text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
          >
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
            Fechar caixa
          </button>
        </div>
      </div>
    </div>
  );
}

/** Relatório Z (fechamento) — tela cheia após fechar o caixa. */
export function RelatorioZ({ z, onNovo }: { z: SessaoRel; onNovo: () => void }) {
  const linha = (label: string, valor: number, destaque = false) => (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-[#8A90A0]">{label}</span>
      <span className={destaque ? 'font-semibold text-[#F7F8FA]' : 'text-[#F7F8FA]'}>{brl(valor)}</span>
    </div>
  );

  const conferido = z.diferenca != null && Math.abs(z.diferenca) < 0.005;

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F4F5F7] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] p-6 shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#01B8FA]/10 ring-1 ring-inset ring-[#01B8FA]/20">
            <Printer className="h-5 w-5 text-[#01B8FA]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-[#F7F8FA]">Relatório Z</h2>
            <p className="text-xs text-[#8A90A0]">
              Caixa fechado · {z.operador} · {z.qtdVendas} venda(s)
            </p>
          </div>
        </div>
        <div className="mt-3 divide-y divide-[#EEF0F2] rounded-xl border border-[#23262F] bg-[#0C0D10] px-3">
          {linha('Fundo de troco', z.saldoInicial)}
          {linha('Vendas em dinheiro', z.totalDinheiro)}
          {linha('Vendas no cartão', z.totalCartao)}
          {linha('Vendas no PIX', z.totalPix)}
          {linha('Suprimentos', z.totalSuprimento)}
          {linha('Sangrias', -z.totalSangria)}
          {linha('Total vendido', z.totalVendas, true)}
        </div>
        <div className="mt-3 space-y-1 rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-1.5">
          {linha('Esperado na gaveta', z.dinheiroEsperadoGaveta, true)}
          {linha('Dinheiro contado', z.saldoFinalInformado ?? 0, true)}
          <div
            className={`flex justify-between py-1.5 text-sm font-semibold ${
              conferido ? 'text-[#01B8FA]' : 'text-rose-600'
            }`}
          >
            <span>Diferença (dinheiro)</span>
            <span>{brl(z.diferenca ?? 0)}</span>
          </div>
        </div>
        {(z.cartaoInformado != null || z.pixInformado != null) && (
          <div className="mt-3 space-y-1 rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-1.5">
            {z.cartaoInformado != null && (
              <>
                {linha('Cartão informado', z.cartaoInformado)}
                <div
                  className={`flex justify-between py-1 text-xs font-semibold ${
                    Math.abs(z.diferencaCartao ?? 0) < 0.005 ? 'text-[#01B8FA]' : 'text-rose-600'
                  }`}
                >
                  <span>Diferença (cartão)</span>
                  <span>{brl(z.diferencaCartao ?? 0)}</span>
                </div>
              </>
            )}
            {z.pixInformado != null && (
              <>
                {linha('PIX informado', z.pixInformado)}
                <div
                  className={`flex justify-between py-1 text-xs font-semibold ${
                    Math.abs(z.diferencaPix ?? 0) < 0.005 ? 'text-[#01B8FA]' : 'text-rose-600'
                  }`}
                >
                  <span>Diferença (PIX)</span>
                  <span>{brl(z.diferencaPix ?? 0)}</span>
                </div>
              </>
            )}
          </div>
        )}
        <button
          onClick={onNovo}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-3.5 text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99]"
        >
          <Unlock className="h-5 w-5" />
          Abrir novo caixa
        </button>
      </div>
    </div>
  );
}

/** Ícones exportados para a barra do caixa. */
export const CaixaIcons = { DollarSign, ArrowDownCircle, ArrowUpCircle };
