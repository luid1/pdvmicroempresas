import { useEffect, useMemo, useState } from 'react';
import {
  Gauge, Store, Users, Building2, Minus, Plus, Check, Sparkles, ShieldCheck, Loader2,
} from 'lucide-react';
import { CadastroShell, TopBar, R$ } from '../../cadastros/ui';
import { toast } from '../../../components/ui/feedback';
import { assinaturaApi } from '../../../services/api';

/**
 * Painel "Minha Assinatura" — mostra o plano contratado e permite ampliar a
 * capacidade (caixas/usuários/lojas extras) DEPOIS que o cliente já assina e
 * confia no produto. É o upsell de capacidade (converte melhor que pedir no
 * checkout). A cobrança recorrente é ajustada de verdade no back-end.
 */

const MESES_GRATIS_ANUAL = 2; // anual = 10 mensalidades (paga 10, leva 12)

type AddonKey = 'pdvs' | 'usuarios' | 'filiais';

// Copy de benefício — foco no ganho concreto do dono da loja, sem jargão.
const ADDON_META: Record<AddonKey, { icon: React.ElementType; nome: string; desc: string }> = {
  pdvs: {
    icon: Store,
    nome: 'Mais um caixa aberto ao mesmo tempo',
    desc: 'Abra uma segunda frente e atenda dois clientes de uma vez. Acaba a fila no horário de pico — e ninguém desiste da compra por causa da espera.',
  },
  usuarios: {
    icon: Users,
    nome: 'Um acesso a mais para a equipe',
    desc: 'Cada funcionário vende com o próprio login. Você enxerga quem fez cada venda e escolhe o que cada um pode ver e mexer — sem senha compartilhada.',
  },
  filiais: {
    icon: Building2,
    nome: 'Mais uma loja no mesmo sistema',
    desc: 'Controle outro ponto com estoque e caixa separados, num painel só. Compare o que cada loja vende sem pagar por um segundo sistema.',
  },
};

interface AddonCat { codigo: AddonKey; nome: string; precoMensal: number; max: number }
interface Status {
  assinado: boolean;
  status?: string;
  periodo?: string;
  proximaCobranca?: string | null;
  trialAte?: string | null;
  plano?: { nome: string; precoMensal: number };
  addons?: Record<AddonKey, number>;
  limites?: { maxPdvs: number | null; maxUsuarios: number | null; maxFiliais: number | null };
}

const ORDEM: AddonKey[] = ['pdvs', 'usuarios', 'filiais'];

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  ATIVA: { txt: 'Ativa', cls: 'bg-emerald-500/15 text-[#0b7d4e]' },
  TRIAL: { txt: 'Em teste', cls: 'bg-slate-500/15 text-[#8B8D98]' },
  SUSPENSA: { txt: 'Suspensa', cls: 'bg-amber-500/15 text-[#a9760a]' },
  CANCELADA: { txt: 'Cancelada', cls: 'bg-rose-500/15 text-[#c3352b]' },
};

export default function MinhaAssinatura() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [catalogo, setCatalogo] = useState<AddonCat[]>([]);
  const [qtd, setQtd] = useState<Record<AddonKey, number>>({ pdvs: 0, usuarios: 0, filiais: 0 });
  const [base, setBase] = useState<Record<AddonKey, number>>({ pdvs: 0, usuarios: 0, filiais: 0 });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [me, cat] = await Promise.all([assinaturaApi.me(), assinaturaApi.addonsCatalogo()]);
      const s: Status = me.data;
      setStatus(s);
      setCatalogo(cat.data);
      const atuais = {
        pdvs: s.addons?.pdvs || 0,
        usuarios: s.addons?.usuarios || 0,
        filiais: s.addons?.filiais || 0,
      };
      setQtd(atuais);
      setBase(atuais);
    } catch {
      toast('Não foi possível carregar sua assinatura.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const anual = status?.periodo === 'anual';
  const precoAddon = (k: AddonKey) => catalogo.find((c) => c.codigo === k)?.precoMensal || 0;
  const maxAddon = (k: AddonKey) => catalogo.find((c) => c.codigo === k)?.max ?? 99;

  const addonsMensal = useMemo(
    () => ORDEM.reduce((acc, k) => acc + qtd[k] * precoAddon(k), 0),
    [qtd, catalogo],
  );
  const baseMensalPlano = Number(status?.plano?.precoMensal || 0);
  const totalMensal = baseMensalPlano + addonsMensal;
  const valorCiclo = anual ? totalMensal * (12 - MESES_GRATIS_ANUAL) : totalMensal;

  const mudou = ORDEM.some((k) => qtd[k] !== base[k]);
  const alterar = (k: AddonKey, delta: number) =>
    setQtd((q) => ({ ...q, [k]: Math.max(0, Math.min(maxAddon(k), q[k] + delta)) }));

  const confirmar = async () => {
    setSalvando(true);
    try {
      const { data } = await assinaturaApi.alterarAddons(qtd);
      toast('Capacidade atualizada. A cobrança já reflete o novo valor.', 'success');
      setBase({ ...qtd });
      // Reflete os novos limites vindos do back-end.
      setStatus((s) => (s ? { ...s, addons: data.addons, limites: data.limites } : s));
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Não foi possível atualizar a capacidade.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const st = status?.status ? STATUS_LABEL[status.status] : undefined;
  const limTxt = (v: number | null | undefined) => (v == null ? 'Ilimitado' : String(v));

  return (
    <CadastroShell>
      <TopBar
        icon={<Gauge className="h-4 w-4" />}
        titulo="Minha Assinatura"
        subtitulo="Plano contratado e ampliação de capacidade"
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {carregando ? (
            <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : !status?.assinado ? (
            <div className="text-center text-slate-500 py-24">
              <Gauge className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma assinatura ativa encontrada para esta conta.</p>
            </div>
          ) : (
            <>
              {/* Resumo do plano */}
              <div className="bg-[#F6F5F2] backdrop-blur-xl border border-[#E7E5DF] rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[#16171D]">{status.plano?.nome}</h2>
                      {st && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.txt}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Cobrança {anual ? 'anual' : 'mensal'}
                      {status.proximaCobranca && ` · próxima em ${new Date(status.proximaCobranca).toLocaleDateString('pt-BR')}`}
                      {status.status === 'TRIAL' && status.trialAte && ` · teste até ${new Date(status.trialAte).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#16171D] tabular-nums">{R$(valorCiclo)}</p>
                    <p className="text-[11px] text-slate-500">{anual ? 'por ano' : 'por mês'}</p>
                  </div>
                </div>

                {/* Capacidade atual */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#E7E5DF]">
                  {([['pdvs', 'Caixas', status.limites?.maxPdvs], ['usuarios', 'Usuários', status.limites?.maxUsuarios], ['filiais', 'Lojas', status.limites?.maxFiliais]] as const).map(
                    ([k, rot, val]) => (
                      <div key={k} className="text-center">
                        <p className="text-lg font-bold text-[#16171D] tabular-nums">{limTxt(val)}</p>
                        <p className="text-[11px] text-slate-500">{rot}</p>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Ampliar capacidade */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-[#a9760a]" />
                  <h3 className="text-sm font-bold text-[#16171D]">Precisa de mais fôlego?</h3>
                </div>

                <div className="space-y-3">
                  {ORDEM.map((k) => {
                    const meta = ADDON_META[k];
                    const Icon = meta.icon;
                    const preco = precoAddon(k);
                    const n = qtd[k];
                    return (
                      <div key={k} className="bg-[#F6F5F2] border border-[#E7E5DF] rounded-xl p-4 flex items-start gap-4">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/12 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-[#a9760a]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#16171D] leading-snug">{meta.nome}</p>
                          <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">{meta.desc}</p>
                          <p className="text-[12px] text-slate-500 mt-1.5 font-semibold">+ {R$(preco)}/mês por unidade</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-1">
                          <button
                            onClick={() => alterar(k, -1)}
                            disabled={n <= 0}
                            className="h-8 w-8 rounded-lg bg-[#F6F5F2] border border-[#E7E5DF] text-[#8B8D98] hover:bg-[#F6F5F2] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-7 text-center text-sm font-bold text-[#16171D] tabular-nums">{n}</span>
                          <button
                            onClick={() => alterar(k, +1)}
                            disabled={n >= maxAddon(k)}
                            className="h-8 w-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Barra de confirmação */}
              <div className="sticky bottom-0 bg-[#F6F5F2] backdrop-blur-xl border border-[#E7E5DF] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
                <div>
                  <p className="text-[11px] text-slate-500">Add-ons por mês</p>
                  <p className="text-base font-bold text-[#16171D] tabular-nums">{R$(addonsMensal)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] text-slate-500">Novo total {anual ? 'anual' : 'mensal'}</p>
                    <p className="text-base font-bold text-[#a9760a] tabular-nums">{R$(valorCiclo)}</p>
                  </div>
                  <button
                    onClick={confirmar}
                    disabled={!mudou || salvando}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {salvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando…</> : <><Check className="h-4 w-4" /> Confirmar capacidade</>}
                  </button>
                </div>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" /> A alteração ajusta a cobrança recorrente. Você pode reduzir quando quiser.
              </p>
            </>
          )}
        </div>
      </div>
    </CadastroShell>
  );
}
