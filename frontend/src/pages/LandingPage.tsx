import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, ScanBarcode, Boxes, ReceiptText, Wallet, Users, BarChart3,
  Check, ArrowRight, Store, Clock, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Plano = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  precoMensal: string;
  maxUsuarios: number | null;
  maxFiliais: number;
  maxPdvs: number;
  features: string[];
  trialDias: number;
};

/** Códigos de feature → texto amigável exibido nos planos. */
const FEATURE_LABEL: Record<string, string> = {
  PDV: 'Frente de caixa (PDV)',
  ESTOQUE: 'Controle de estoque',
  CADASTROS: 'Cadastro de produtos',
  RELATORIOS_BASICOS: 'Relatórios básicos',
  NFCE: 'Cupom fiscal (NFC-e)',
  FINANCEIRO: 'Financeiro completo',
  TESOURARIA: 'Tesouraria',
  TEF: 'Maquininha (TEF)',
  VALIDADE: 'Controle de validade',
  PRECIFICACAO: 'Precificação',
  DEVOLUCOES: 'Devoluções',
  RELATORIOS_VENDAS: 'Relatórios de vendas',
  NFE: 'Nota fiscal (NF-e)',
  MULTIFILIAL: 'Multi-loja',
  IA_PEDIDOS: 'IA de pedidos',
  RECORRENCIAS: 'Contas recorrentes',
  PLANO_CONTAS: 'Plano de contas',
  AUDITORIA: 'Auditoria',
  RELATORIOS_GERENCIAIS: 'Relatórios gerenciais',
  NOTIFICACOES: 'Notificações',
  API: 'Acesso via API',
};

const DESTAQUE = 'PROFISSIONAL';

const brl = (v: string) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const limite = (n: number | null, sufixo: string) =>
  n === null || n >= 999 ? `${sufixo} ilimitados` : `${n} ${sufixo}${n > 1 ? 's' : ''}`;

export default function LandingPage() {
  const { user } = useAuth();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const destinoApp = user ? '/dashboard' : '/login';

  useEffect(() => {
    fetch('/api/v1/planos')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPlanos(Array.isArray(d) ? d : []))
      .catch(() => setPlanos([]));
  }, []);

  const features = [
    { Icon: ScanBarcode, titulo: 'Frente de caixa veloz', texto: 'Código de barras, balança, desconto e sangria. Passe produtos e feche a venda em segundos.' },
    { Icon: Boxes, titulo: 'Estoque em tempo real', texto: 'Entradas, inventário, validade de perecíveis e alerta de mínimo — tudo integrado à venda.' },
    { Icon: ReceiptText, titulo: 'Cupom e nota fiscal', texto: 'Emita NFC-e no caixa e NF-e quando precisar, dentro das regras do Simples Nacional.' },
    { Icon: Wallet, titulo: 'Financeiro sob controle', texto: 'Contas a pagar/receber, fluxo de caixa, tesouraria e DRE pra saber o que sobra no fim do mês.' },
    { Icon: Users, titulo: 'Equipe com PIN', texto: 'Cada funcionário entra pelo próprio perfil com PIN de 4 dígitos. Rápido e rastreável.' },
    { Icon: BarChart3, titulo: 'Relatórios que decidem', texto: 'Vendas por período, produtos que mais saem, margem e desempenho por loja.' },
  ];

  return (
    <div className="login-canvas relative min-h-screen overflow-x-hidden text-slate-200">
      {/* Fundo com orbs */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="login-orb-1 absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-sky-500/[0.22] blur-[120px]" />
        <div className="login-orb-2 absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.18] blur-[130px]" />
        <div className="login-orb-3 absolute top-[120%] -right-28 h-[520px] w-[520px] rounded-full bg-violet-500/[0.18] blur-[120px]" />
      </div>

      {/* ═══════════ NAVBAR (login no topo) ═══════════ */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#topo" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15">
              <ShoppingCart className="h-5 w-5 text-sky-400" />
            </div>
            <span className="text-white font-bold tracking-tight">Lumin PDV</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={destinoApp}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              {user ? 'Ir para o sistema' : 'Entrar'}
            </Link>
            <a
              href="#planos"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors"
            >
              Começar <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ═══════════ HERO (vendas) ═══════════ */}
      <section id="topo" className="relative z-10 mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-1.5 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-[12px] font-semibold text-sky-300 tracking-wide">PDV + Gestão para micro e pequenas empresas</span>
        </div>

        <h1 className="mx-auto max-w-3xl text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight text-white">
          Sua loja vendendo<br />
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">rápida e organizada.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          Frente de caixa, estoque, cupom fiscal e financeiro num só lugar — na nuvem, com os
          dados da sua empresa isolados e vários computadores conectados à mesma loja.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#planos"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-colors"
          >
            Ver planos e começar <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            to={destinoApp}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.07] transition-colors"
          >
            {user ? 'Ir para o sistema' : 'Já sou cliente — entrar'}
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-sky-400" /> 7 dias grátis</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Dados isolados por empresa</span>
          <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-violet-400" /> Vários caixas na mesma loja</span>
        </div>
      </section>

      {/* ═══════════ RECURSOS ═══════════ */}
      <section id="recursos" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Tudo que a loja precisa</h2>
          <p className="mt-3 text-slate-400">Do produto ao cupom, sem planilha e sem depender de um computador ligado.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, titulo, texto }) => (
            <div key={titulo} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 mb-4">
                <Icon className="h-5.5 w-5.5 text-sky-400" />
              </div>
              <h3 className="text-white font-semibold">{titulo}</h3>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ PLANOS ═══════════ */}
      <section id="planos" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Planos que crescem com você</h2>
          <p className="mt-3 text-slate-400">Comece simples e libere recursos conforme a loja cresce. 7 dias grátis em todos.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 items-start">
          {planos.map((p) => {
            const destaque = p.codigo === DESTAQUE;
            const enterprise = Number(p.precoMensal) === 0;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  destaque
                    ? 'border-sky-400/50 bg-sky-500/[0.06] shadow-xl shadow-sky-500/10 lg:-translate-y-2'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}
              >
                {destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold text-white shadow-lg">
                    Mais popular
                  </span>
                )}
                <h3 className="text-white font-bold text-lg">{p.nome}</h3>
                <p className="mt-1 text-xs text-slate-400 min-h-[2.5rem] leading-snug">{p.descricao}</p>

                <div className="mt-4 mb-5">
                  {enterprise ? (
                    <p className="text-2xl font-extrabold text-white">Sob consulta</p>
                  ) : (
                    <p className="flex items-baseline gap-1">
                      <span className="text-sm text-slate-400">R$</span>
                      <span className="text-4xl font-extrabold text-white tabular-nums">{brl(p.precoMensal)}</span>
                      <span className="text-sm text-slate-400">/mês</span>
                    </p>
                  )}
                </div>

                <ul className="space-y-2 text-sm text-slate-300 flex-1">
                  <li className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4 text-slate-500" /> {limite(p.maxUsuarios, 'usuário')}
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <Store className="h-4 w-4 text-slate-500" /> {limite(p.maxFiliais, 'loja')} · {p.maxPdvs} {p.maxPdvs > 1 ? 'caixas' : 'caixa'}
                  </li>
                  {p.features.slice(0, 6).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {FEATURE_LABEL[f] || f}
                    </li>
                  ))}
                  {p.features.length > 6 && (
                    <li className="text-xs text-slate-500 pl-6">+ {p.features.length - 6} recursos</li>
                  )}
                </ul>

                <Link
                  to={destinoApp}
                  className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    destaque
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                      : 'border border-white/[0.12] bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
                  }`}
                >
                  {enterprise ? 'Falar com a gente' : 'Assinar plano'}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Já tem conta?{' '}
          <Link to={destinoApp} className="text-sky-400 hover:text-sky-300 font-semibold">Entrar no sistema</Link>
        </p>
      </section>

      {/* ═══════════ RODAPÉ ═══════════ */}
      <footer className="relative z-10 border-t border-white/[0.06] mt-8">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
              <ShoppingCart className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-slate-400 text-sm">Lumin PDV · Gestão e Frente de Caixa</span>
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Lumin PDV · v1.0.0</p>
        </div>
      </footer>
    </div>
  );
}
