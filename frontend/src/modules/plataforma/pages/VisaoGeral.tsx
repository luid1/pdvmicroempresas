import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Building2, Users, Coins, TrendingUp,
  CheckCircle2, Ban, Clock, PauseCircle, ArrowRight,
} from 'lucide-react';
import { plataformaApi } from '../../../services/api';
import { Loader } from '../../cadastros/ui';

// ── Helpers ───────────────────────────────────────────────────────────────
const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const precoDaLoja = (l: any) => Number(l?.assinatura?.plano?.precoMensal || 0);

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  TRIAL:     { label: 'Em teste', cls: 'text-[#E8A317]', icon: Clock },
  ATIVA:     { label: 'Ativas',   cls: 'text-[#2DD4A7]', icon: CheckCircle2 },
  SUSPENSA:  { label: 'Suspensas', cls: 'text-[#F59E0B]', icon: PauseCircle },
  CANCELADA: { label: 'Canceladas', cls: 'text-[#FF6B7A]', icon: Ban },
};

// ══════════════════════════════════════════════════════════════════════════
//  Visão Geral da plataforma (SaaS) — KPIs derivados de /plataforma/lojas.
// ══════════════════════════════════════════════════════════════════════════
export default function VisaoGeral() {
  const [lojas, setLojas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    plataformaApi
      .listarLojas()
      .then((r) => setLojas(r.data || []))
      .catch(() => setLojas([]))
      .finally(() => setLoading(false));
  }, []);

  const m = useMemo(() => {
    const total = lojas.length;
    const ativas = lojas.filter((l) => l.ativo).length;
    const inativas = total - ativas;
    const totalFiliais = lojas.reduce((s, l) => s + (l.filiaisCount || 0), 0);
    const totalUsuarios = lojas.reduce((s, l) => s + (l.usuariosCount || 0), 0);

    const porStatus: Record<string, number> = { TRIAL: 0, ATIVA: 0, SUSPENSA: 0, CANCELADA: 0 };
    lojas.forEach((l) => {
      const st = l.assinatura?.status;
      if (st && porStatus[st] !== undefined) porStatus[st] += 1;
    });

    // MRR = receita recorrente mensal das assinaturas ATIVAS.
    const mrr = lojas
      .filter((l) => l.assinatura?.status === 'ATIVA')
      .reduce((s, l) => s + precoDaLoja(l), 0);
    // Potencial em teste: o que entra se os trials converterem.
    const potencialTrial = lojas
      .filter((l) => l.assinatura?.status === 'TRIAL')
      .reduce((s, l) => s + precoDaLoja(l), 0);

    const topReceita = [...lojas]
      .filter((l) => precoDaLoja(l) > 0)
      .sort((a, b) => precoDaLoja(b) - precoDaLoja(a))
      .slice(0, 6);

    return { total, ativas, inativas, totalFiliais, totalUsuarios, porStatus, mrr, potencialTrial, topReceita };
  }, [lojas]);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-[#22D3EE]/12 border border-[#22D3EE]/25 flex items-center justify-center text-[#01B8FA]">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Visão Geral da Plataforma</h1>
          <p className="text-xs text-[#8B8D98]">Saúde do seu SaaS num relance — todas as lojas, assinaturas e receita.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader /></div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={Store}      cor="#01B8FA" titulo="Lojas"      valor={m.total}         legenda={`${m.ativas} ativas · ${m.inativas} inativas`} />
            <Kpi icon={Building2}  cor="#8B5CF6" titulo="Filiais"    valor={m.totalFiliais}  legenda="unidades no total" />
            <Kpi icon={Users}      cor="#F59E0B" titulo="Usuários"   valor={m.totalUsuarios} legenda="contas de acesso" />
            <Kpi icon={Coins}      cor="#2DD4A7" titulo="MRR"        valor={brl(m.mrr)}      legenda="receita recorrente/mês" destaque />
            <Kpi icon={TrendingUp} cor="#22D3EE" titulo="Em teste"   valor={brl(m.potencialTrial)} legenda="potencial se converter" />
            <Kpi icon={CheckCircle2} cor="#2DD4A7" titulo="Assinaturas ativas" valor={m.porStatus.ATIVA} legenda="pagantes" />
          </div>

          {/* Assinaturas por status + Top receita */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status das assinaturas */}
            <section className="bg-[#101216] border border-[#23262F] rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#16171D] mb-3">Assinaturas por status</h3>
              <div className="space-y-2.5">
                {(['ATIVA', 'TRIAL', 'SUSPENSA', 'CANCELADA'] as const).map((st) => {
                  const meta = STATUS_META[st];
                  const StIcon = meta.icon;
                  const qtd = m.porStatus[st] || 0;
                  const pct = m.total ? Math.round((qtd / m.total) * 100) : 0;
                  return (
                    <div key={st}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`flex items-center gap-1.5 font-semibold ${meta.cls}`}>
                          <StIcon className="h-3.5 w-3.5" /> {meta.label}
                        </span>
                        <span className="text-[#8B8D98]">{qtd} · {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#F1F1F3] overflow-hidden">
                        <div className="h-full rounded-full bg-current opacity-80" style={{ width: `${pct}%`, color: 'currentColor' }}>
                          <span className={meta.cls} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Top lojas por receita */}
            <section className="bg-[#101216] border border-[#23262F] rounded-xl p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#16171D]">Maiores receitas</h3>
                <button
                  onClick={() => navigate('/plataforma/assinaturas')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#01B8FA] hover:underline"
                >
                  Ver assinaturas <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {m.topReceita.length === 0 ? (
                <p className="text-xs text-[#8B8D98] py-4 text-center">Nenhuma loja com plano precificado ainda.</p>
              ) : (
                <div className="divide-y divide-[#F0EEE9]">
                  {m.topReceita.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => navigate('/plataforma')}
                      className="w-full flex items-center justify-between py-2 gap-2 text-left hover:bg-white/[0.03] rounded-lg px-1 -mx-1"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#16171D] truncate">{l.nomeFantasia || l.razaoSocial}</p>
                        <p className="text-xs text-[#8B8D98] truncate">{l.assinatura?.plano?.nome || l.plano || 'Sem plano'}</p>
                      </div>
                      <span className="text-sm font-bold text-[#2DD4A7] shrink-0">{brl(precoDaLoja(l))}<span className="text-[10px] text-[#8B8D98] font-normal">/mês</span></span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Atalhos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Atalho
              icon={Store} titulo="Gerenciar lojas & clientes"
              texto="Criar, editar, ativar/desativar lojas e suas filiais."
              onClick={() => navigate('/plataforma')}
            />
            <Atalho
              icon={Coins} titulo="Assinaturas & receita"
              texto="Acompanhe status de cobrança, planos e MRR por loja."
              onClick={() => navigate('/plataforma/assinaturas')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── UI ──────────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, cor, titulo, valor, legenda, destaque }: {
  icon: any; cor: string; titulo: string; valor: React.ReactNode; legenda?: string; destaque?: boolean;
}) {
  return (
    <div className={`bg-[#101216] border rounded-xl p-3.5 ${destaque ? 'border-[#2DD4A7]/40' : 'border-[#23262F]'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cor}1f`, color: cor }}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-semibold text-[#8B8D98] uppercase tracking-wide truncate">{titulo}</p>
      </div>
      <p className="text-xl font-bold text-[#16171D] leading-tight">{valor}</p>
      {legenda && <p className="text-[11px] text-[#8B8D98] mt-0.5 truncate">{legenda}</p>}
    </div>
  );
}

function Atalho({ icon: Icon, titulo, texto, onClick }: { icon: any; titulo: string; texto: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-[#101216] border border-[#23262F] rounded-xl p-4 hover:border-[#22D3EE]/40 transition-colors group flex items-start gap-3"
    >
      <span className="h-9 w-9 rounded-xl bg-[#22D3EE]/12 border border-[#22D3EE]/25 flex items-center justify-center text-[#01B8FA] shrink-0">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#16171D] group-hover:text-[#01B8FA] flex items-center gap-1">
          {titulo} <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </p>
        <p className="text-xs text-[#8B8D98] mt-0.5">{texto}</p>
      </div>
    </button>
  );
}
