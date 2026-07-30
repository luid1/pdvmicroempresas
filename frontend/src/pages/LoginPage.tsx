import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Eye, EyeOff, Lock, Mail, ShoppingCart, ArrowLeft, Delete,
  Store, Shield, Crown, ShoppingBag, Boxes, User as UserIcon,
} from 'lucide-react';
import { rotaInicial } from '../config/telas';

/** Tenant "vinculado" a este computador (gravado após o 1º login). */
type PairedTenant = { id: string; nome: string };
type Perfil = {
  id: string;
  nome: string;
  email: string;
  temPin: boolean;
  role: { nome: string };
  ultimoAcesso: string | null;
};

const PAIR_KEY = 'wms_paired_tenant';

/** Aparência de cada perfil na tela de seleção. */
const ROLE_UI: Record<string, { label: string; Icon: typeof Shield; ring: string; bg: string; text: string }> = {
  ADMIN:          { label: 'Administrador', Icon: Crown,       ring: 'ring-amber-400/40',   bg: 'bg-amber-500/15',   text: 'text-amber-300' },
  GERENTE:        { label: 'Gerente',       Icon: Shield,      ring: 'ring-sky-400/40',     bg: 'bg-sky-500/15',     text: 'text-sky-300' },
  OPERADOR_CAIXA: { label: 'Caixa',         Icon: ShoppingBag, ring: 'ring-emerald-400/40', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  ESTOQUISTA:     { label: 'Estoque',       Icon: Boxes,       ring: 'ring-violet-400/40',  bg: 'bg-violet-500/15',  text: 'text-violet-300' },
};
const roleUi = (nome: string) => ROLE_UI[nome] || { label: nome, Icon: UserIcon, ring: 'ring-slate-400/40', bg: 'bg-slate-500/15', text: 'text-slate-300' };

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');

export default function LoginPage() {
  const [hora, setHora] = useState(new Date());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado de vínculo do computador.
  const [paired, setPaired] = useState<PairedTenant | null>(() => {
    try { return JSON.parse(localStorage.getItem(PAIR_KEY) || 'null'); } catch { return null; }
  });

  // 'PAIR' = vincular loja (e-mail+senha) · 'PICKER' = escolher perfil · 'PIN' = digitar PIN/senha
  const [modo, setModo] = useState<'PAIR' | 'PICKER' | 'PIN'>(paired ? 'PICKER' : 'PAIR');
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(false);
  const [selecionado, setSelecionado] = useState<Perfil | null>(null);

  // Relógio
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Carrega os perfis da loja vinculada.
  useEffect(() => {
    if (modo === 'PICKER' && paired) carregarPerfis(paired.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, paired?.id]);

  async function carregarPerfis(tenantId: string) {
    setCarregandoPerfis(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/auth/users?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error('Não foi possível carregar os perfis.');
      setPerfis(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar os perfis.');
    } finally {
      setCarregandoPerfis(false);
    }
  }

  /** Grava a sessão no localStorage e redireciona para a tela inicial do perfil. */
  function entrar(data: any) {
    const authUser = { ...data.usuario, tenantId: data.tenant.id };
    const filiais = data.usuario.filiais || [];
    localStorage.setItem('wms_token', data.token);
    localStorage.setItem('wms_user', JSON.stringify(authUser));
    localStorage.setItem('wms_filiais', JSON.stringify(filiais));
    if (filiais[0]) localStorage.setItem('wms_filial', JSON.stringify(filiais[0]));
    window.location.href = rotaInicial(data.usuario.telas, data.usuario.role, data.usuario.telaInicial);
  }

  function desvincular() {
    localStorage.removeItem(PAIR_KEY);
    setPaired(null);
    setPerfis([]);
    setSelecionado(null);
    setError('');
    setModo('PAIR');
  }

  return (
    <div className="login-canvas relative overflow-hidden min-h-screen flex">

      {/* Fundo animado */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="login-orb-1 absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-sky-500/[0.28] blur-[120px]" />
        <div className="login-orb-2 absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.22] blur-[130px]" />
        <div className="login-orb-3 absolute -bottom-32 -right-28 h-[520px] w-[520px] rounded-full bg-violet-500/[0.24] blur-[120px]" />
        <div className="login-orb-1 absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full bg-cyan-500/[0.14] blur-[130px]" />
      </div>

      {/* ═══════════ BANNER LATERAL ═══════════ */}
      <aside className="hidden lg:flex w-[42%] xl:w-[38%] relative z-10 flex-col justify-between overflow-hidden border-r border-white/[0.06] p-10">
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 drop-shadow-[0_2px_12px_rgba(56,189,248,0.25)]">
            <ShoppingCart className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <p className="text-white text-lg font-bold leading-none tracking-tight">Lumin PDV</p>
            <p className="text-slate-400 text-xs mt-1.5">Gestão e Frente de Caixa</p>
          </div>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.28em]">ERP</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
            Sua venda<br />
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300 bg-clip-text text-transparent">rápida e simples.</span>
          </h1>
          <p className="text-slate-400 text-base mt-5 max-w-md leading-relaxed">
            Feito para micro e pequenas empresas: frente de caixa, estoque e caixa do dia em um só lugar — do produto ao cupom.
          </p>
        </div>

        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-white text-3xl font-mono font-bold tabular-nums leading-none">
              {hora.toLocaleTimeString('pt-BR')}
            </p>
            <p className="text-slate-500 text-sm mt-1.5 capitalize">
              {hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            Acesso restrito · v1.0.0
          </div>
        </div>
      </aside>

      {/* ═══════════ ÁREA DIREITA ═══════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative z-10">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
            <ShoppingCart className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-white text-sm font-bold">Lumin PDV</p>
        </div>

        {modo === 'PAIR' && (
          <PairForm
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            onPaired={(tenant, data) => {
              const p = { id: tenant.id, nome: tenant.nomeFantasia || tenant.razaoSocial };
              localStorage.setItem(PAIR_KEY, JSON.stringify(p));
              setPaired(p);
              entrar(data); // o 1º login já entra direto com quem vinculou
            }}
          />
        )}

        {modo === 'PICKER' && paired && (
          <ProfilePicker
            tenantNome={paired.nome}
            perfis={perfis}
            carregando={carregandoPerfis}
            error={error}
            onSelecionar={(p) => { setSelecionado(p); setError(''); setModo('PIN'); }}
            onDesvincular={desvincular}
          />
        )}

        {modo === 'PIN' && selecionado && (
          <PinPad
            perfil={selecionado}
            loading={loading}
            error={error}
            setError={setError}
            onVoltar={() => { setSelecionado(null); setError(''); setModo('PICKER'); }}
            onEntrar={async (credencial) => {
              setLoading(true);
              setError('');
              try {
                const url = credencial.tipo === 'pin' ? '/api/v1/auth/login-pin' : '/api/v1/auth/login-por-id';
                const body = credencial.tipo === 'pin'
                  ? { usuarioId: selecionado.id, pin: credencial.valor }
                  : { usuarioId: selecionado.id, password: credencial.valor };
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Credencial incorreta.');
                entrar(data);
              } catch (err: any) {
                setError(err.message || 'Não foi possível entrar.');
                setLoading(false);
              }
            }}
          />
        )}

        <p className="lg:hidden absolute bottom-5 text-slate-600 text-[11px]">
          Lumin PDV · Acesso restrito · v1.0.0
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 1 — Vincular o computador à loja (e-mail + senha)
──────────────────────────────────────────────────────────── */
function PairForm({ loading, setLoading, error, setError, onPaired }: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  onPaired: (tenant: any, data: any) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 100); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'E-mail ou senha incorretos.');
      onPaired(data.tenant, data);
    } catch (err: any) {
      setError(err.message);
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 border border-sky-400/20 px-3 py-1 mb-3">
          <Store className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider">Primeiro acesso</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Vincular este computador</h2>
        <p className="text-slate-500 text-sm mt-1">
          Entre uma vez com o acesso da sua loja. Depois é só clicar no perfil e digitar o PIN.
        </p>
      </div>

      <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" aria-hidden />
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input
                ref={emailRef}
                type="email"
                className="w-full bg-white/[0.04] border border-white/[0.10] text-white rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 transition-all"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="w-full bg-white/[0.04] border border-white/[0.10] text-white rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 transition-all"
                placeholder="Digite sua senha..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/60 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="text-red-500">✕</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Verificando...
              </span>
            ) : 'Vincular e entrar'}
          </button>
        </form>
      </div>

      <p className="text-center text-slate-500 text-xs">
        Ainda não tem uma conta?{' '}
        <a href={`${import.meta.env.VITE_SITE_URL || 'http://localhost:4010'}/assinar.html`} className="text-sky-400 hover:text-sky-300 font-semibold">
          Comece agora
        </a>
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 2 — Escolher o perfil (cartões)
──────────────────────────────────────────────────────────── */
function ProfilePicker({ tenantNome, perfis, carregando, error, onSelecionar, onDesvincular }: {
  tenantNome: string;
  perfis: Perfil[];
  carregando: boolean;
  error: string;
  onSelecionar: (p: Perfil) => void;
  onDesvincular: () => void;
}) {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1 mb-3">
            <Store className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[11px] font-semibold text-slate-300 tracking-wide">{tenantNome}</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Quem vai usar agora?</h2>
          <p className="text-slate-500 text-sm mt-1">Toque no seu perfil para entrar.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/60 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {carregando ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : perfis.length === 0 ? (
        <div className="text-slate-500 text-sm bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 text-center">
          Nenhum perfil ativo encontrado nesta loja.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {perfis.map((p) => {
            const ui = roleUi(p.role.nome);
            return (
              <button
                key={p.id}
                onClick={() => onSelecionar(p)}
                className={`group relative flex flex-col items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 transition-all hover:bg-white/[0.06] hover:-translate-y-0.5 hover:border-white/20 focus:outline-none focus:ring-2 ${ui.ring}`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${ui.bg} ring-1 ${ui.ring}`}>
                  <span className={`text-lg font-bold ${ui.text}`}>{iniciais(p.nome)}</span>
                </div>
                <div className="text-center">
                  <p className="text-white text-sm font-semibold leading-tight line-clamp-1">{p.nome}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 text-[11px] font-medium ${ui.text}`}>
                    <ui.Icon className="h-3 w-3" /> {ui.label}
                  </span>
                </div>
                {!p.temPin && (
                  <span className="absolute top-2 right-2 text-[9px] text-slate-500 bg-slate-800/60 rounded px-1.5 py-0.5">senha</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center pt-2">
        <button onClick={onDesvincular} className="text-slate-500 hover:text-slate-300 text-xs inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Trocar de loja / desvincular este computador
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 3 — Digitar o PIN (ou senha, se o perfil não tiver PIN)
──────────────────────────────────────────────────────────── */
function PinPad({ perfil, loading, error, setError, onVoltar, onEntrar }: {
  perfil: Perfil;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  onVoltar: () => void;
  onEntrar: (c: { tipo: 'pin' | 'senha'; valor: string }) => void;
}) {
  const ui = roleUi(perfil.role.nome);
  const [usarSenha, setUsarSenha] = useState(!perfil.temPin);
  const [pin, setPin] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const enviouRef = useRef(false);

  // Autoenvio quando o PIN chega a 4 dígitos.
  useEffect(() => {
    if (!usarSenha && pin.length === 4 && !loading && !enviouRef.current) {
      enviouRef.current = true;
      onEntrar({ tipo: 'pin', valor: pin });
    }
    if (pin.length < 4) enviouRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, usarSenha, loading]);

  // Limpa o PIN quando dá erro, pra tentar de novo.
  useEffect(() => { if (error) setPin(''); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const digitar = (d: string) => { setError(''); setPin((p) => (p.length < 4 ? p + d : p)); };
  const apagar = () => { setError(''); setPin((p) => p.slice(0, -1)); };

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-sm space-y-6">
      <button onClick={onVoltar} className="text-slate-500 hover:text-slate-300 text-sm inline-flex items-center gap-1.5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Trocar de perfil
      </button>

      {/* Cabeçalho do perfil selecionado */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${ui.bg} ring-1 ${ui.ring}`}>
          <span className={`text-xl font-bold ${ui.text}`}>{iniciais(perfil.nome)}</span>
        </div>
        <div>
          <p className="text-white text-lg font-bold leading-tight">{perfil.nome}</p>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${ui.text}`}>
            <ui.Icon className="h-3.5 w-3.5" /> {ui.label}
          </span>
        </div>
      </div>

      {!usarSenha ? (
        <>
          <p className="text-center text-slate-400 text-sm">Digite seu PIN de 4 dígitos</p>

          {/* Bolinhas do PIN */}
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-all ${i < pin.length ? 'bg-sky-400 scale-110 shadow-[0_0_10px_rgba(56,189,248,0.7)]' : 'bg-white/15'}`}
              />
            ))}
          </div>

          {error && <p className="text-center text-red-400 text-sm">{error}</p>}

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
            {teclas.map((t) => (
              <button
                key={t}
                onClick={() => digitar(t)}
                disabled={loading}
                className="h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-2xl font-semibold hover:bg-white/[0.09] active:scale-95 transition-all disabled:opacity-40"
              >
                {t}
              </button>
            ))}
            <div />
            <button
              onClick={() => digitar('0')}
              disabled={loading}
              className="h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-2xl font-semibold hover:bg-white/[0.09] active:scale-95 transition-all disabled:opacity-40"
            >
              0
            </button>
            <button
              onClick={apagar}
              disabled={loading}
              className="h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-slate-400 flex items-center justify-center hover:bg-white/[0.06] active:scale-95 transition-all disabled:opacity-40"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> Entrando...
            </div>
          )}

          <p className="text-center">
            <button onClick={() => { setError(''); setUsarSenha(true); }} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              Prefiro entrar com a senha
            </button>
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); if (senha) onEntrar({ tipo: 'senha', valor: senha }); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input
                autoFocus
                type={showPwd ? 'text' : 'password'}
                className="w-full bg-white/[0.04] border border-white/[0.10] text-white rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 transition-all"
                placeholder="Digite sua senha..."
                value={senha}
                onChange={(e) => { setError(''); setSenha(e.target.value); }}
                required
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/60 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="text-red-500">✕</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !senha}
            className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> Entrando...
              </span>
            ) : 'Entrar no Sistema'}
          </button>

          {perfil.temPin && (
            <p className="text-center">
              <button type="button" onClick={() => { setError(''); setUsarSenha(false); }} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                Voltar para o PIN
              </button>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
