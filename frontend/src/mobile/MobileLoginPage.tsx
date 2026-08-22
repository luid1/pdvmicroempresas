import { FormEvent, useEffect, useState } from 'react';
import { Building2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMobileManifest } from './useMobileManifest';

export default function MobileLoginPage() {
  useMobileManifest();
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!isLoading && user) navigate('/app', { replace: true });
  }, [isLoading, navigate, user]);

  const entrar = async (event: FormEvent) => {
    event.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setErro('');
    try {
      await login(email.trim(), senha, cnpj);
      navigate('/app', { replace: true });
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível entrar. Confira seus dados.');
      setSenha('');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#071018] text-white lg:flex lg:items-center lg:justify-center lg:p-6">
      <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#0A141D] px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))] shadow-2xl lg:min-h-[860px] lg:rounded-[36px] lg:border lg:border-white/10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#01B8FA]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-[#0FA968]/10 blur-3xl" />

        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#01B8FA] text-[#062B38] shadow-[0_10px_30px_-10px_rgba(1,184,250,.8)]">
              <span className="font-display text-xl font-black">L</span>
            </div>
            <div>
              <p className="font-display text-lg font-extrabold leading-none">Lumin</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.18em] text-[#7C8794]">Acompanhe</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#0FA968]/25 bg-[#0FA968]/10 px-2.5 py-1 text-[10px] font-semibold text-[#62D5A3]">
            <ShieldCheck className="h-3 w-3" /> Somente consulta
          </span>
        </header>

        <div className="relative mt-16">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[.06]">
            <Smartphone className="h-5 w-5 text-[#3DC8FB]" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#3DC8FB]">Seu negócio no bolso</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-tight">
            Veja sua operação<br />de onde estiver.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#9BA8B5]">
            Entre com o seu usuário do Lumin para acompanhar vendas, estoque e resultados da sua loja.
          </p>
        </div>

        <form onSubmit={entrar} className="relative mt-10 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.12em] text-[#8995A2]">CNPJ da loja</span>
            <span className="relative block">
              <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808F]" />
              <input
                inputMode="numeric"
                autoComplete="organization"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-14 w-full rounded-2xl border border-white/10 bg-white/[.055] pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#536271] focus:border-[#01B8FA]/70 focus:ring-4 focus:ring-[#01B8FA]/10"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.12em] text-[#8995A2]">E-mail</span>
            <span className="relative block">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808F]" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@sualoja.com"
                className="h-14 w-full rounded-2xl border border-white/10 bg-white/[.055] pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#536271] focus:border-[#01B8FA]/70 focus:ring-4 focus:ring-[#01B8FA]/10"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.12em] text-[#8995A2]">Senha</span>
            <span className="relative block">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#70808F]" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="h-14 w-full rounded-2xl border border-white/10 bg-white/[.055] pl-11 pr-12 text-sm text-white outline-none placeholder:text-[#536271] focus:border-[#01B8FA]/70 focus:ring-4 focus:ring-[#01B8FA]/10"
                required
              />
              <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#70808F]" aria-label="Mostrar ou ocultar senha">
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {erro && <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{erro}</p>}

          <button
            type="submit"
            disabled={entrando || !cnpj.trim() || !email.trim() || !senha}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#01B8FA] text-sm font-extrabold text-[#062B38] shadow-[0_14px_32px_-14px_rgba(1,184,250,.85)] transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {entrando ? 'Entrando…' : 'Entrar no aplicativo'}
          </button>
        </form>

        <p className="relative mt-auto pt-10 text-center text-[11px] leading-5 text-[#687785]">
          Acesso protegido e vinculado às permissões do seu usuário.<br />Nenhum dado pode ser alterado pelo aplicativo.
        </p>
      </section>
    </main>
  );
}
