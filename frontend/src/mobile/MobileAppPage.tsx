import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Boxes, Building2, ChevronDown, CircleDollarSign,
  Home, LogOut, MessageCircle, Package, RefreshCw, Search, Send, ShieldCheck,
  ShoppingBag, Sparkles, TrendingUp, UserRound, Wallet,
} from 'lucide-react';
import api, { estoqueApi, iaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useMobileManifest } from './useMobileManifest';

type Aba = 'inicio' | 'vendas' | 'estoque' | 'lu' | 'conta';

interface DashboardMobile {
  periodoLabel?: string;
  financeiro?: {
    faturamento?: number;
    vendas?: number;
    ticketMedio?: number;
    margemBruta?: number;
    resultadoOperacional?: number;
    receber?: { total?: number };
    pagar?: { total?: number };
  };
  estoque?: {
    itensComSaldo?: number;
    valorEstoque?: number;
    rupturas?: number;
    validade?: { vencido?: number; ate3?: number; ate7?: number };
  };
  topProdutos?: { produtoId: string; codigo: string; descricao: string; qtd: number; custo: number }[];
  serieFaturamento?: { dia: string; label: string; valor: number }[];
}

interface SaldoMobile {
  id: string;
  quantidade: number;
  quantidadeDisponivel: number;
  custoMedio: number;
  abaixoMinimo: boolean;
  alertaValidade: boolean;
  produto: { codigo: string; descricao: string; estoqueMinimo: number; unidadeMedida?: { sigla?: string } };
}

const dinheiro = (valor?: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
}).format(Number(valor || 0));

const numero = (valor?: number) => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Cartao({ titulo, valor, detalhe, icon: Icon, cor = 'sky' }: {
  titulo: string; valor: string; detalhe?: string; icon: any; cor?: 'sky' | 'green' | 'amber' | 'violet';
}) {
  const cores = {
    sky: 'bg-[#E4F5FD] text-[#087BA8]', green: 'bg-[#E6F8F0] text-[#0B8B59]',
    amber: 'bg-[#FFF3DD] text-[#AD6608]', violet: 'bg-[#F0ECFF] text-[#6951C8]',
  };
  return (
    <article className="rounded-[22px] border border-[#E7EBEF] bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,.55)]">
      <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${cores[cor]}`}><Icon className="h-4 w-4" /></div>
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8A949D]">{titulo}</p>
      <p className="mt-1 truncate text-xl font-extrabold tracking-tight text-[#17212A]">{valor}</p>
      {detalhe && <p className="mt-1 truncate text-[11px] text-[#8A949D]">{detalhe}</p>}
    </article>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="rounded-[22px] border border-dashed border-[#D8DEE4] bg-white/60 px-5 py-10 text-center text-sm text-[#7D8994]">{texto}</div>;
}

export default function MobileAppPage() {
  useMobileManifest();
  const { user, filiais, filialAtiva, setFilialAtiva, logout } = useAuth();
  const [aba, setAba] = useState<Aba>('inicio');
  const [dashboard, setDashboard] = useState<DashboardMobile | null>(null);
  const [estoque, setEstoque] = useState<SaldoMobile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [pergunta, setPergunta] = useState('');
  const [respostaLu, setRespostaLu] = useState('Olá! Posso consultar vendas, estoque e resultados da sua loja. Não consigo alterar nenhum dado.');
  const [consultandoLu, setConsultandoLu] = useState(false);

  const carregar = useCallback(async () => {
    if (!filialAtiva?.id) return;
    setCarregando(true);
    setErro('');
    try {
      const [dash, saldo] = await Promise.all([
        api.get('/dashboard', { params: { filialId: filialAtiva.id, periodo: 'mes' } }),
        estoqueApi.posicao(filialAtiva.id),
      ]);
      setDashboard(dash.data);
      setEstoque(Array.isArray(saldo.data) ? saldo.data : []);
    } catch {
      setDashboard(null);
      setEstoque([]);
      setErro('Não foi possível atualizar os dados agora. Tente novamente em instantes.');
    } finally {
      setCarregando(false);
    }
  }, [filialAtiva?.id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo ? estoque.filter((item) =>
      item.produto.descricao.toLowerCase().includes(termo) || item.produto.codigo.toLowerCase().includes(termo),
    ) : estoque;
    return [...lista].sort((a, b) => Number(a.quantidadeDisponivel) - Number(b.quantidadeDisponivel));
  }, [busca, estoque]);

  const perguntarLu = async (texto?: string) => {
    const mensagem = (texto || pergunta).trim();
    if (!mensagem || consultandoLu) return;
    setPergunta('');
    setConsultandoLu(true);
    try {
      const { data } = await iaApi.comando(mensagem, [], filialAtiva?.id);
      if (data?.tipo === 'resposta' || data?.tipo === 'esclarecer') setRespostaLu(data.texto);
      else setRespostaLu('O aplicativo está em modo somente consulta. Nenhuma alteração foi realizada.');
    } catch {
      setRespostaLu('Não consegui consultar agora. Tente novamente em instantes.');
    } finally {
      setConsultandoLu(false);
    }
  };

  const f = dashboard?.financeiro;
  const e = dashboard?.estoque;
  const alertas = estoque.filter((item) => item.abaixoMinimo || item.alertaValidade).length;
  const primeiroNome = user?.nome?.split(' ')[0] || 'você';

  const conteudo = {
    inicio: (
      <div className="space-y-5">
        <section className="rounded-[26px] bg-[#0A1722] p-5 text-white shadow-[0_18px_44px_-28px_rgba(4,15,25,.9)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#93A4B3]">Faturamento do mês</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{dinheiro(f?.faturamento)}</p>
              <p className="mt-2 text-xs text-[#7F92A2]">{numero(f?.vendas)} vendas · ticket {dinheiro(f?.ticketMedio)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#01B8FA]/15 text-[#3DC8FB]"><TrendingUp className="h-5 w-5" /></div>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <Cartao titulo="A receber" valor={dinheiro(f?.receber?.total)} icon={Wallet} cor="green" />
          <Cartao titulo="A pagar" valor={dinheiro(f?.pagar?.total)} icon={CircleDollarSign} cor="amber" />
          <Cartao titulo="Itens em estoque" valor={numero(e?.itensComSaldo)} detalhe={dinheiro(e?.valorEstoque)} icon={Boxes} cor="sky" />
          <Cartao titulo="Alertas" valor={numero(alertas)} detalhe="estoque e validade" icon={AlertTriangle} cor="violet" />
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#17212A]">Produtos em destaque</h2>
            <button onClick={() => setAba('vendas')} className="text-xs font-bold text-[#087BA8]">Ver vendas</button>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-[#E7EBEF] bg-white">
            {(dashboard?.topProdutos || []).slice(0, 4).map((produto, index) => (
              <div key={produto.produtoId} className="flex items-center gap-3 border-b border-[#EEF1F4] px-4 py-3.5 last:border-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1F4F6] text-xs font-black text-[#68747E]">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#26313A]">{produto.descricao}</p><p className="text-[11px] text-[#8C969F]">{produto.codigo}</p></div>
                <p className="text-sm font-extrabold text-[#17212A]">{numero(produto.qtd)}</p>
              </div>
            ))}
            {!dashboard?.topProdutos?.length && <p className="px-4 py-8 text-center text-sm text-[#8C969F]">Sem vendas no período.</p>}
          </div>
        </section>
      </div>
    ),
    vendas: (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Cartao titulo="Faturamento" valor={dinheiro(f?.faturamento)} icon={BarChart3} cor="sky" />
          <Cartao titulo="Vendas" valor={numero(f?.vendas)} icon={ShoppingBag} cor="green" />
          <Cartao titulo="Ticket médio" valor={dinheiro(f?.ticketMedio)} icon={CircleDollarSign} cor="violet" />
          <Cartao titulo="Margem bruta" valor={`${numero(f?.margemBruta)}%`} icon={TrendingUp} cor="amber" />
        </div>
        <section>
          <h2 className="mb-3 text-sm font-extrabold text-[#17212A]">Mais vendidos neste mês</h2>
          <div className="space-y-2.5">
            {(dashboard?.topProdutos || []).map((produto, index) => (
              <article key={produto.produtoId} className="flex items-center gap-3 rounded-[20px] border border-[#E7EBEF] bg-white p-4">
                <span className="text-lg font-black text-[#CCD3D9]">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#26313A]">{produto.descricao}</p><p className="text-[11px] text-[#8C969F]">{produto.codigo}</p></div>
                <div className="text-right"><p className="text-sm font-extrabold text-[#17212A]">{numero(produto.qtd)}</p><p className="text-[10px] text-[#8C969F]">unidades</p></div>
              </article>
            ))}
            {!dashboard?.topProdutos?.length && <Vazio texto="Nenhuma venda encontrada neste mês." />}
          </div>
        </section>
      </div>
    ),
    estoque: (
      <div className="space-y-4">
        <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D98A1]" /><input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar produto ou código" className="h-12 w-full rounded-2xl border border-[#E0E5E9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#01A9E8] focus:ring-4 focus:ring-[#01B8FA]/10" /></div>
        <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#7D8994]">{itensFiltrados.length} itens encontrados</p><span className="rounded-full bg-[#FFF3DD] px-2.5 py-1 text-[10px] font-bold text-[#AD6608]">{alertas} alertas</span></div>
        <div className="space-y-2.5">
          {itensFiltrados.slice(0, 50).map((item) => (
            <article key={item.id} className="rounded-[20px] border border-[#E7EBEF] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.abaixoMinimo || item.alertaValidade ? 'bg-[#FFF0E8] text-[#C45E25]' : 'bg-[#E8F6FC] text-[#087BA8]'}`}><Package className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#26313A]">{item.produto.descricao}</p><p className="mt-0.5 text-[11px] text-[#8C969F]">{item.produto.codigo}</p></div>
                <div className="text-right"><p className="text-base font-black text-[#17212A]">{numero(item.quantidadeDisponivel)}</p><p className="text-[10px] uppercase text-[#8C969F]">{item.produto.unidadeMedida?.sigla || 'un'}</p></div>
              </div>
              {(item.abaixoMinimo || item.alertaValidade) && <p className="mt-3 rounded-xl bg-[#FFF7F0] px-3 py-2 text-[11px] font-semibold text-[#A65323]">{item.abaixoMinimo ? 'Abaixo do estoque mínimo' : 'Atenção à validade'}</p>}
            </article>
          ))}
          {!itensFiltrados.length && !carregando && <Vazio texto="Nenhum item encontrado nesta filial." />}
        </div>
      </div>
    ),
    lu: (
      <div className="flex min-h-[560px] flex-col">
        <section className="rounded-[26px] bg-[#0A1722] p-5 text-white">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#01B8FA] text-[#062B38]"><Sparkles className="h-5 w-5" /></div><div><p className="font-extrabold">Lu</p><p className="text-[11px] text-[#83CBE6]">Assistente de consulta do ERP</p></div></div>
          <div className="mt-5 rounded-2xl bg-white/[.07] p-4 text-sm leading-6 text-[#DBE7EE]">{consultandoLu ? 'Consultando os dados da sua loja…' : respostaLu}</div>
        </section>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Como estão minhas vendas?', 'O que está acabando?', 'Qual produto mais vendeu?'].map((atalho) => <button key={atalho} onClick={() => void perguntarLu(atalho)} className="rounded-full border border-[#DCE3E8] bg-white px-3 py-2 text-[11px] font-semibold text-[#55636E]">{atalho}</button>)}
        </div>
        <form onSubmit={(ev) => { ev.preventDefault(); void perguntarLu(); }} className="mt-auto flex items-center gap-2 rounded-[20px] border border-[#DCE3E8] bg-white p-2 pl-4 shadow-sm"><input value={pergunta} onChange={(ev) => setPergunta(ev.target.value)} placeholder="Pergunte sobre sua loja…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9AA4AC]" /><button disabled={!pergunta.trim() || consultandoLu} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#01B8FA] text-[#062B38] disabled:opacity-40"><Send className="h-4 w-4" /></button></form>
      </div>
    ),
    conta: (
      <div className="space-y-4">
        <section className="rounded-[26px] bg-[#0A1722] p-5 text-white"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#01B8FA]/15 text-lg font-black text-[#3DC8FB]">{primeiroNome.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-lg font-extrabold">{user?.nome}</p><p className="truncate text-xs text-[#8FA2B1]">{user?.email}</p></div></div><div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#0FA968]/10 px-3 py-2.5 text-xs font-semibold text-[#62D5A3]"><ShieldCheck className="h-4 w-4" /> Acesso somente para consulta</div></section>
        <section className="rounded-[22px] border border-[#E7EBEF] bg-white p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#8A949D]">Filial consultada</p><div className="relative"><Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C8994]" /><select value={filialAtiva?.id || ''} onChange={(ev) => { const filial = filiais.find((item) => item.id === ev.target.value); if (filial) setFilialAtiva(filial); }} className="h-12 w-full appearance-none rounded-2xl border border-[#E0E5E9] bg-[#F8FAFB] pl-10 pr-10 text-sm font-semibold text-[#26313A] outline-none">{filiais.map((filial) => <option key={filial.id} value={filial.id}>{filial.nome}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C8994]" /></div></section>
        <button onClick={() => { logout(); window.location.href = '/app/login'; }} className="flex h-13 w-full items-center justify-center gap-2 rounded-[18px] border border-red-200 bg-white py-3.5 text-sm font-bold text-red-600"><LogOut className="h-4 w-4" /> Sair do aplicativo</button>
      </div>
    ),
  }[aba];

  const titulos: Record<Aba, string> = { inicio: `Olá, ${primeiroNome}`, vendas: 'Vendas', estoque: 'Estoque', lu: 'Fale com a Lu', conta: 'Minha conta' };
  const nav: { id: Aba; label: string; icon: any }[] = [
    { id: 'inicio', label: 'Início', icon: Home }, { id: 'vendas', label: 'Vendas', icon: BarChart3 },
    { id: 'estoque', label: 'Estoque', icon: Boxes }, { id: 'lu', label: 'Lu', icon: MessageCircle },
    { id: 'conta', label: 'Conta', icon: UserRound },
  ];

  return (
    <main className="min-h-[100dvh] bg-[#071018] lg:flex lg:items-center lg:justify-center lg:p-5">
      <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#F5F7F9] text-[#17212A] shadow-2xl lg:h-[calc(100dvh-2.5rem)] lg:min-h-[760px] lg:rounded-[36px] lg:border lg:border-white/10">
        <header className="shrink-0 bg-[#F5F7F9]/95 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#8B969F]">Lumin Acompanhe</p><h1 className="mt-1 text-xl font-black tracking-tight">{titulos[aba]}</h1></div><button onClick={() => void carregar()} aria-label="Atualizar dados" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E0E5E9] bg-white text-[#66737E]"><RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /></button></div>
          <div className="mt-3 flex items-center gap-2"><span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#596772] shadow-sm"><Building2 className="h-3 w-3 shrink-0 text-[#01A6E1]" /><span className="truncate">{filialAtiva?.nome || 'Sem filial vinculada'}</span></span><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E6F8F0] px-2.5 py-1.5 text-[10px] font-bold text-[#0B8B59]"><ShieldCheck className="h-3 w-3" /> Consulta</span></div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          {erro && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erro}</div>}
          {carregando && !dashboard ? <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-[22px] bg-white" />)}</div> : conteudo}
        </div>

        <nav className="grid shrink-0 grid-cols-5 border-t border-[#E1E6EA] bg-white px-2 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2">
          {nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setAba(id)} className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[9px] font-bold transition ${aba === id ? 'text-[#0786B7]' : 'text-[#8A959E]'}`}><span className={`flex h-8 w-10 items-center justify-center rounded-xl ${aba === id ? 'bg-[#E4F5FD]' : ''}`}><Icon className="h-[18px] w-[18px]" /></span>{label}</button>)}
        </nav>
      </section>
    </main>
  );
}
