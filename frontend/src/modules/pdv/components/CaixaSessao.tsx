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
};

function extrairMsg(e: any, fallback: string) {
  const msg = e?.response?.data?.message || fallback;
  return Array.isArray(msg) ? msg[0] : msg;
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
    <div className="flex h-full flex-col items-center justify-center bg-gray-950 p-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-6 w-6 text-amber-400" />
          <h2 className="text-lg font-semibold text-gray-100">Caixa fechado</h2>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          Informe o fundo de troco inicial na gaveta para abrir o caixa.
        </p>

        <label className="text-sm text-gray-400">Fundo de troco (R$)</label>
        <input
          autoFocus
          value={fundo}
          onChange={(e) => setFundo(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-lg text-gray-100 outline-none focus:border-amber-400"
        />

        <label className="mt-4 block text-sm text-gray-400">Observação (opcional)</label>
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex.: turno da manhã"
          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-amber-400"
        />

        {erro && (
          <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</div>
        )}

        <button
          onClick={abrir}
          disabled={salvando}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-4 text-lg font-semibold text-white hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-semibold text-gray-100">{titulo}</h2>
          </div>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <label className="text-sm text-gray-400">Valor (R$)</label>
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-lg text-gray-100 outline-none focus:border-amber-400"
          />
          <label className="mt-4 block text-sm text-gray-400">Motivo (opcional)</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-amber-400"
          />
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</div>
          )}
          <button
            onClick={confirmar}
            disabled={salvando || valorNum <= 0}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-lg font-semibold text-white disabled:bg-gray-800 disabled:text-gray-600 ${cor}`}
          >
            {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de fechamento de caixa (conferência). */
export function ModalFechar({
  esperado,
  onFechar,
  onConfirmar,
}: {
  esperado: number;
  onFechar: () => void;
  onConfirmar: (informado: number, obs: string) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const [informado, setInformado] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const informadoNum = parseFloat(informado.replace(',', '.')) || 0;
  const diferenca = informadoNum - esperado;

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    const res = await onConfirmar(informadoNum, obs);
    if (!res.ok) {
      setErro(res.erro || 'Falha ao fechar o caixa.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-100">Fechar caixa</h2>
          </div>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4 flex justify-between rounded-lg bg-gray-950 px-4 py-3 text-sm">
            <span className="text-gray-400">Dinheiro esperado na gaveta</span>
            <span className="font-semibold text-gray-100">{brl(esperado)}</span>
          </div>
          <label className="text-sm text-gray-400">Dinheiro contado (R$)</label>
          <input
            autoFocus
            value={informado}
            onChange={(e) => setInformado(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-lg text-gray-100 outline-none focus:border-amber-400"
          />
          {informado !== '' && (
            <div
              className={`mt-2 text-right text-sm font-medium ${
                Math.abs(diferenca) < 0.005
                  ? 'text-emerald-400'
                  : diferenca > 0
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {Math.abs(diferenca) < 0.005
                ? 'Caixa confere'
                : diferenca > 0
                ? `Sobra ${brl(diferenca)}`
                : `Falta ${brl(-diferenca)}`}
            </div>
          )}
          <label className="mt-4 block text-sm text-gray-400">Observação (opcional)</label>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-amber-400"
          />
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</div>
          )}
          <button
            onClick={confirmar}
            disabled={salvando || informado === ''}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-lg font-semibold text-white hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600"
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
      <span className="text-gray-400">{label}</span>
      <span className={destaque ? 'font-semibold text-gray-100' : 'text-gray-200'}>{brl(valor)}</span>
    </div>
  );

  const conferido = z.diferenca != null && Math.abs(z.diferenca) < 0.005;

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-950 p-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Printer className="h-6 w-6 text-amber-400" />
          <h2 className="text-lg font-semibold text-gray-100">Relatório Z · Caixa fechado</h2>
        </div>
        <div className="text-xs text-gray-500">
          {z.operador} · {z.qtdVendas} venda(s)
        </div>
        <div className="mt-3 divide-y divide-gray-800 border-y border-gray-800">
          {linha('Fundo de troco', z.saldoInicial)}
          {linha('Vendas em dinheiro', z.totalDinheiro)}
          {linha('Vendas no cartão', z.totalCartao)}
          {linha('Vendas no PIX', z.totalPix)}
          {linha('Suprimentos', z.totalSuprimento)}
          {linha('Sangrias', -z.totalSangria)}
          {linha('Total vendido', z.totalVendas, true)}
        </div>
        <div className="mt-3 space-y-1">
          {linha('Esperado na gaveta', z.dinheiroEsperadoGaveta, true)}
          {linha('Contado', z.saldoFinalInformado ?? 0, true)}
          <div
            className={`flex justify-between py-1.5 text-sm font-semibold ${
              conferido ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            <span>Diferença</span>
            <span>{brl(z.diferenca ?? 0)}</span>
          </div>
        </div>
        <button
          onClick={onNovo}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-lg font-semibold text-white hover:bg-amber-500"
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
