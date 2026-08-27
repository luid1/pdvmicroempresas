import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Search, TrendingUp, Store as StoreIcon } from 'lucide-react';
import { plataformaApi } from '../../../services/api';
import { inp, Loader, Vazio } from '../../cadastros/ui';

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const precoDaLoja = (l: any) => Number(l?.assinatura?.plano?.precoMensal || 0);

const STATUS_ASSINATURA: Record<string, { label: string; cls: string }> = {
  TRIAL:     { label: 'Em teste',  cls: 'bg-amber-500/12 text-[#a9760a] border-[#E8A317]/30' },
  ATIVA:     { label: 'Ativa',     cls: 'bg-emerald-500/12 text-[#2DD4A7] border-emerald-500/30' },
  SUSPENSA:  { label: 'Suspensa',  cls: 'bg-orange-500/12 text-[#c2590a] border-orange-500/30' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-500/12 text-[#FF6B7A] border-rose-500/30' },
  SEM:       { label: 'Sem plano', cls: 'bg-[#F1F1F3] text-[#8B8D98] border-[#E7E5DF]' },
};

const FILTROS = [
  { v: 'todas', l: 'Todas' },
  { v: 'ATIVA', l: 'Ativas' },
  { v: 'TRIAL', l: 'Em teste' },
  { v: 'SUSPENSA', l: 'Suspensas' },
  { v: 'CANCELADA', l: 'Canceladas' },
];

// ══════════════════════════════════════════════════════════════════════════
//  Assinaturas & Receita — visão de cobrança de todas as lojas do SaaS.
// ══════════════════════════════════════════════════════════════════════════
export default function Assinaturas() {
  const [lojas, setLojas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    plataformaApi
      .listarLojas()
      .then((r) => setLojas(r.data || []))
      .catch(() => setLojas([]))
      .finally(() => setLoading(false));
  }, []);

  const { mrr, potencial, ativas, total, lista } = useMemo(() => {
    const mrr = lojas.filter((l) => l.assinatura?.status === 'ATIVA').reduce((s, l) => s + precoDaLoja(l), 0);
    const potencial = lojas.filter((l) => l.assinatura?.status === 'TRIAL').reduce((s, l) => s + precoDaLoja(l), 0);
    const ativas = lojas.filter((l) => l.assinatura?.status === 'ATIVA').length;

    const termo = q.trim().toLowerCase();
    const lista = lojas
      .filter((l) => {
        const st = l.assinatura?.status || 'SEM';
        if (filtro !== 'todas' && st !== filtro) return false;
        if (!termo) return true;
        return (
          (l.razaoSocial || '').toLowerCase().includes(termo) ||
          (l.nomeFantasia || '').toLowerCase().includes(termo) ||
          (l.cnpj || '').includes(termo)
        );
      })
      .sort((a, b) => precoDaLoja(b) - precoDaLoja(a));

    return { mrr, potencial, ativas, total: lojas.length, lista };
  }, [lojas, q, filtro]);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-[#2DD4A7]/12 border border-[#2DD4A7]/25 flex items-center justify-center text-[#2DD4A7]">
          <Coins className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Assinaturas & Receita</h1>
          <p className="text-xs text-[#8B8D98]">Cobrança de todas as lojas — status, planos e receita recorrente.</p>
        </div>
      </div>

      {/* Resumo de receita */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <Resumo icon={Coins}      cor="#2DD4A7" titulo="MRR (recorrente/mês)" valor={brl(mrr)} />
        <Resumo icon={TrendingUp} cor="#22D3EE" titulo="Potencial em teste"   valor={brl(potencial)} />
        <Resumo icon={StoreIcon}  cor="#01B8FA" titulo="Assinaturas ativas"   valor={`${ativas}`} />
        <Resumo icon={StoreIcon}  cor="#8B5CF6" titulo="Total de lojas"       valor={`${total}`} />
      </div>

      {/* Filtros */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A90A0]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja por nome ou CNPJ..." className={`${inp} pl-9`} />
        </div>
        <div className="flex gap-1 bg-[#F1F1F3] rounded-lg p-0.5 flex-wrap">
          {FILTROS.map((o) => (
            <button
              key={o.v}
              onClick={() => setFiltro(o.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filtro === o.v ? 'bg-[#101216] text-[#16171D] shadow-sm' : 'text-[#8B8D98] hover:text-[#16171D]'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <Loader />
        ) : lista.length === 0 ? (
          <Vazio icon={<Coins className="h-10 w-10" />} texto="Nenhuma assinatura encontrada" />
        ) : (
          <div className="bg-[#101216] border border-[#23262F] rounded-xl overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-[#23262F] text-[10px] font-bold text-[#8B8D98] uppercase tracking-wide">
              <div className="col-span-5">Loja</div>
              <div className="col-span-3">Plano</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Receita/mês</div>
            </div>
            <div className="divide-y divide-[#F0EEE9]">
              {lista.map((l) => {
                const st = l.assinatura?.status || 'SEM';
                const meta = STATUS_ASSINATURA[st] || STATUS_ASSINATURA.SEM;
                return (
                  <button
                    key={l.id}
                    onClick={() => navigate('/plataforma')}
                    className="w-full grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03] items-center"
                  >
                    <div className="col-span-2 md:col-span-5 min-w-0">
                      <p className="text-sm font-semibold text-[#16171D] truncate">{l.nomeFantasia || l.razaoSocial}</p>
                      <p className="text-xs text-[#8B8D98] truncate">{l.razaoSocial}</p>
                    </div>
                    <div className="md:col-span-3 min-w-0">
                      <p className="text-xs text-[#5B5D69] truncate">{l.assinatura?.plano?.nome || l.plano || '—'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <span className="text-sm font-bold text-[#16171D]">{precoDaLoja(l) > 0 ? brl(precoDaLoja(l)) : '—'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Resumo({ icon: Icon, cor, titulo, valor }: { icon: any; cor: string; titulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}1f`, color: cor }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-[#8B8D98] uppercase tracking-wide truncate">{titulo}</p>
        <p className="text-base font-bold text-[#16171D] leading-tight">{valor}</p>
      </div>
    </div>
  );
}
