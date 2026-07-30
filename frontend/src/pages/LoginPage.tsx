import { useState, useEffect, useRef, FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, ShoppingCart } from 'lucide-react';
import { rotaInicial } from '../config/telas';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hora, setHora] = useState(new Date());
  const emailRef = useRef<HTMLInputElement>(null);

  // Relógio em tempo real
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Foca no e-mail ao abrir
  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 100);
  }, []);

  const handleLogin = async (e: FormEvent) => {
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
      if (!res.ok) throw new Error(data.message || data.error?.message || 'E-mail ou senha incorretos.');

      // Persiste sessão
      const authUser = { ...data.usuario, tenantId: data.tenant.id };
      const filiais = data.usuario.filiais || [];
      localStorage.setItem('wms_token', data.token);
      localStorage.setItem('wms_user', JSON.stringify(authUser));
      localStorage.setItem('wms_filiais', JSON.stringify(filiais));
      if (filiais[0]) localStorage.setItem('wms_filial', JSON.stringify(filiais[0]));
      window.location.href = rotaInicial(data.usuario.telas, data.usuario.role, data.usuario.telaInicial);
    } catch (err: any) {
      setError(err.message);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-canvas relative overflow-hidden min-h-screen flex">

      {/* Fundo animado — orbs flutuantes atrás de tudo */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="login-orb-1 absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-sky-500/[0.28] blur-[120px]" />
        <div className="login-orb-2 absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.22] blur-[130px]" />
        <div className="login-orb-3 absolute -bottom-32 -right-28 h-[520px] w-[520px] rounded-full bg-violet-500/[0.24] blur-[120px]" />
        <div className="login-orb-1 absolute top-1/3 right-1/4 h-[360px] w-[360px] rounded-full bg-cyan-500/[0.14] blur-[130px]" />
      </div>

      {/* ═══════════ BANNER LATERAL (esquerda) ═══════════ */}
      <aside className="hidden lg:flex w-[42%] xl:w-[38%] relative z-10 flex-col justify-between overflow-hidden border-r border-white/[0.06] p-10">

        {/* Topo — marca */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 drop-shadow-[0_2px_12px_rgba(56,189,248,0.25)]">
            <ShoppingCart className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <p className="text-white text-lg font-bold leading-none tracking-tight">Lumin PDV</p>
            <p className="text-slate-400 text-xs mt-1.5">Gestão e Frente de Caixa</p>
          </div>
        </div>

        {/* Centro — frase de impacto */}
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

        {/* Base — relógio */}
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

      {/* ═══════════ ÁREA DE LOGIN (direita) ═══════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative z-10">

        {/* Marca compacta — só no mobile */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
            <ShoppingCart className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-white text-sm font-bold">Lumin PDV</p>
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Cabeçalho */}
          <div>
            <h2 className="text-2xl font-bold text-white">Entrar na sua conta</h2>
            <p className="text-slate-500 text-sm mt-1">Use o e-mail e a senha do seu acesso.</p>
          </div>

          {/* Formulário — placa de vidro */}
          <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" aria-hidden />
            <form onSubmit={handleLogin} className="space-y-4">
              {/* E-mail */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <input
                    ref={emailRef}
                    type="email"
                    className="w-full bg-white/[0.04] border border-white/[0.10] text-white rounded-xl px-4 py-3 pl-9 text-sm
                               placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 transition-all"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="w-full bg-white/[0.04] border border-white/[0.10] text-white rounded-xl px-4 py-3 pl-9 text-sm
                               placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 transition-all"
                    placeholder="Digite sua senha..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
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
                className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold
                           py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2
                           disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    Verificando...
                  </span>
                ) : (
                  'Entrar no Sistema'
                )}
              </button>
            </form>
          </div>

          {/* Rodapé do card — link para assinar */}
          <p className="text-center text-slate-500 text-xs">
            Ainda não tem uma conta?{' '}
            <a href={`${import.meta.env.VITE_SITE_URL || 'http://localhost:4010'}/assinar.html`} className="text-sky-400 hover:text-sky-300 font-semibold">
              Comece agora
            </a>
          </p>
        </div>

        {/* Rodapé compacto (mobile) */}
        <p className="lg:hidden absolute bottom-5 text-slate-600 text-[11px]">
          Lumin PDV · Acesso restrito · v1.0.0
        </p>
      </div>
    </div>
  );
}
