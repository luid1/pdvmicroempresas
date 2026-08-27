import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, RefreshCw, Save, ShieldCheck, Store } from 'lucide-react';
import { pdvApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../../components/ui/feedback';

// Operações do caixa que PODEM exigir a senha gerencial. Cada loja liga/desliga
// o que quiser — mercadinho pequeno costuma exigir menos; loja maior, mais.
const OPERACOES: { key: OpKey; label: string; hint: string }[] = [
  { key: 'senhaCancelarVenda', label: 'Cancelar venda', hint: 'Descartar toda a venda em andamento' },
  { key: 'senhaRemoverItem', label: 'Remover item', hint: 'Apagar um item já bipado da comanda' },
  { key: 'senhaDesconto', label: 'Aplicar desconto', hint: 'Abrir a tela de desconto na venda' },
  { key: 'senhaSangria', label: 'Sangria', hint: 'Retirar dinheiro da gaveta' },
  { key: 'senhaSuprimento', label: 'Suprimento', hint: 'Reforço de troco na gaveta' },
  { key: 'senhaFecharCaixa', label: 'Fechar caixa', hint: 'Encerrar o turno / relatório Z' },
  { key: 'senhaEstorno', label: 'Estornar venda', hint: 'Cancelar uma venda já registrada' },
];

type OpKey =
  | 'senhaCancelarVenda'
  | 'senhaRemoverItem'
  | 'senhaDesconto'
  | 'senhaSangria'
  | 'senhaSuprimento'
  | 'senhaFecharCaixa'
  | 'senhaEstorno';

type Form = Record<OpKey, boolean> & { senhaGerencial: string; senhaGerencial2: string };

const VAZIO: Form = {
  senhaGerencial: '',
  senhaGerencial2: '',
  senhaCancelarVenda: true,
  senhaRemoverItem: true,
  senhaDesconto: true,
  senhaSangria: true,
  senhaSuprimento: false,
  senhaFecharCaixa: true,
  senhaEstorno: true,
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? 'bg-[#01B8FA]' : 'bg-[#D1D5DB]'
      }`}
      aria-pressed={on}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-[#101216] shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function ConfigCaixa() {
  const { filiais, filialAtiva, refreshFiliais } = useAuth();
  const [filialId, setFilialId] = useState(filialAtiva?.id || '');
  const [form, setForm] = useState<Form>(VAZIO);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { void refreshFiliais().catch(() => {}); }, [refreshFiliais]);
  useEffect(() => { if (!filialId && filialAtiva?.id) setFilialId(filialAtiva.id); }, [filialId, filialAtiva?.id]);

  const carregar = useCallback(async () => {
    if (!filialId) { setLoading(false); return; }
    setLoading(true); setErro('');
    try {
      const { data } = await pdvApi.configCaixaGet(filialId);
      setSenhaDefinida(!!data.senhaDefinida);
      setForm({
        senhaGerencial: '',
        senhaGerencial2: '',
        senhaCancelarVenda: !!data.senhaCancelarVenda,
        senhaRemoverItem: !!data.senhaRemoverItem,
        senhaDesconto: !!data.senhaDesconto,
        senhaSangria: !!data.senhaSangria,
        senhaSuprimento: !!data.senhaSuprimento,
        senhaFecharCaixa: !!data.senhaFecharCaixa,
        senhaEstorno: !!data.senhaEstorno,
      });
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao carregar a configuração do caixa.');
    } finally {
      setLoading(false);
    }
  }, [filialId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = async () => {
    if (!filialId) return;
    const s = form.senhaGerencial.trim();
    if (s) {
      if (s.length < 4) { setErro('A senha gerencial deve ter ao menos 4 caracteres.'); return; }
      if (s !== form.senhaGerencial2.trim()) { setErro('A confirmação da senha não confere.'); return; }
    }
    setSalvando(true); setErro('');
    try {
      const { data } = await pdvApi.configCaixaSalvar({
        filialId,
        ...(s ? { senhaGerencial: s } : {}),
        senhaCancelarVenda: form.senhaCancelarVenda,
        senhaRemoverItem: form.senhaRemoverItem,
        senhaDesconto: form.senhaDesconto,
        senhaSangria: form.senhaSangria,
        senhaSuprimento: form.senhaSuprimento,
        senhaFecharCaixa: form.senhaFecharCaixa,
        senhaEstorno: form.senhaEstorno,
      });
      setSenhaDefinida(!!data.senhaDefinida);
      setForm((f) => ({ ...f, senhaGerencial: '', senhaGerencial2: '' }));
      toast('Configuração do caixa salva.');
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível salvar a configuração do caixa.');
    } finally {
      setSalvando(false);
    }
  };

  const algumLigado = OPERACOES.some((o) => form[o.key]);

  return (
    <div className="min-h-full bg-[#0C0D10] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4 pb-24">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[#F7F8FA]">
              <ShieldCheck className="h-5 w-5 text-[#01B8FA]" /> Segurança do Caixa
            </h1>
            <p className="mt-1 text-xs text-[#8A90A0]">
              Defina a senha gerencial da loja e escolha quais operações do caixa exigem essa senha.
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#23262F] bg-[#101216] px-2.5 text-xs">
              <Store className="h-4 w-4 text-[#8A90A0]" />
              <select
                value={filialId}
                onChange={(e) => setFilialId(e.target.value)}
                className="h-9 min-w-0 flex-1 bg-transparent py-1 pr-1 text-[#F7F8FA] outline-none sm:w-64"
              >
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>
                ))}
              </select>
            </div>
            <button
              onClick={carregar}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#23262F] bg-[#101216] px-3 text-xs font-medium text-[#8A90A0] transition-colors hover:bg-[#0C0D10]"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-[#FF6B7A]">{erro}</div>
        )}

        {!filialId ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-[#E8A317]">
            Selecione uma loja para configurar a segurança do caixa.
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-[#23262F] bg-[#101216] p-8 text-center text-sm text-[#8A90A0]">
            Carregando configuração…
          </div>
        ) : (
          <>
            {/* Senha gerencial */}
            <section className="rounded-2xl border border-[#23262F] bg-[#101216] p-5 shadow-[0_1px_2px_rgba(22,23,29,0.04)]">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#01B8FA]/10 ring-1 ring-inset ring-[#01B8FA]/20">
                  <KeyRound className="h-5 w-5 text-[#01B8FA]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#F7F8FA]">Senha gerencial</h2>
                  <p className="text-xs text-[#8A90A0]">
                    Uma senha interna da loja — sem e-mail, sem cadastro. O operador digita para liberar.
                  </p>
                </div>
                <span
                  className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    senhaDefinida
                      ? 'bg-[#01B8FA]/10 text-[#2DD4A7] ring-1 ring-inset ring-[#01B8FA]/20'
                      : 'bg-amber-500/10 text-[#E8A317] ring-1 ring-inset ring-amber-500/30'
                  }`}
                >
                  {senhaDefinida ? 'Configurada' : 'Não configurada'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-[#8A90A0]">
                    {senhaDefinida ? 'Nova senha (deixe em branco p/ manter)' : 'Senha gerencial'}
                  </span>
                  <input
                    type="password"
                    value={form.senhaGerencial}
                    onChange={(e) => set('senhaGerencial', e.target.value)}
                    placeholder="••••"
                    autoComplete="new-password"
                    className="mt-1 h-10 w-full rounded-lg border border-[#23262F] bg-[#0C0D10] px-3 text-sm text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[#8A90A0]">Confirmar senha</span>
                  <input
                    type="password"
                    value={form.senhaGerencial2}
                    onChange={(e) => set('senhaGerencial2', e.target.value)}
                    placeholder="••••"
                    autoComplete="new-password"
                    className="mt-1 h-10 w-full rounded-lg border border-[#23262F] bg-[#0C0D10] px-3 text-sm text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
                  />
                </label>
              </div>
              {!senhaDefinida && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#E8A317]">
                  <Lock className="h-3.5 w-3.5" />
                  Enquanto não houver senha, as operações marcadas ficam bloqueadas no caixa.
                </p>
              )}
            </section>

            {/* Operações que exigem senha */}
            <section className="rounded-2xl border border-[#23262F] bg-[#101216] p-5 shadow-[0_1px_2px_rgba(22,23,29,0.04)]">
              <h2 className="text-sm font-semibold text-[#F7F8FA]">Operações que pedem senha</h2>
              <p className="text-xs text-[#8A90A0]">Ligue o que, nesta loja, só um responsável pode liberar.</p>
              <div className="mt-3 divide-y divide-white/[0.06]">
                {OPERACOES.map((o) => (
                  <div key={o.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F7F8FA]">{o.label}</div>
                      <div className="text-xs text-[#8A90A0]">{o.hint}</div>
                    </div>
                    <Toggle on={form[o.key]} onClick={() => set(o.key, !form[o.key])} />
                  </div>
                ))}
              </div>
              {algumLigado && !senhaDefinida && form.senhaGerencial.trim() === '' && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-[#E8A317]">
                  Defina uma senha gerencial acima para que essas exigências funcionem.
                </p>
              )}
            </section>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-2 rounded-xl bg-[#01B8FA] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0d7a64] disabled:cursor-not-allowed disabled:bg-[#23262F] disabled:text-[#B0B2B7]"
              >
                <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
