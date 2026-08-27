import { useState, useEffect, useRef, FormEvent } from 'react';
import {
  Eye, EyeOff, Lock, Mail, ArrowLeft,
  Store, Shield, Crown, ShoppingBag, Boxes, Building2, User as UserIcon,
} from 'lucide-react';
import { rotaInicial } from '../config/telas';

/** Tenant "vinculado" a este computador (gravado após liberar o 1º acesso). */
type PairedTenant = { id: string; nome: string; token: string };
type Perfil = {
  id: string;
  nome: string;
  temPin: boolean;
  role: { nome: string };
  ultimoAcesso: string | null;
};

const PAIR_KEY = 'wms_paired_tenant';
const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://nimble-nasturtium.netlify.app';

/**
 * Acesso OCULTO do dono da plataforma. O login do dono não aparece mais na tela
 * — só é revelado quando a URL contém este parâmetro (ex.: /login?c2h5oh).
 * Guarde este link: ele é a única porta de entrada visível para o painel do SaaS.
 * (A segurança real continua no backend: e-mail + senha + isSuperAdmin.)
 */
const DONO_PARAM = 'c2h5oh';
const querAcessoDono = () => {
  try { return new URLSearchParams(window.location.search).has(DONO_PARAM); }
  catch { return false; }
};

/**
 * Aparência de cada perfil na tela de seleção.
 * Alinhada ao design do site (luminmkt.shop): base escura + azul #01B8FA.
 * O ADMIN recebe o azul da marca; os demais, um tom neutro sobre o escuro.
 */
const ROLE_UI: Record<string, { label: string; Icon: typeof Shield; ring: string; bg: string; text: string }> = {
  ADMIN:          { label: 'Administrador', Icon: Crown,       ring: 'ring-[#01B8FA]/30', bg: 'bg-[#01B8FA]/15', text: 'text-[#3DC8FB]' },
  GERENTE:        { label: 'Gerente',       Icon: Shield,      ring: 'ring-white/15',      bg: 'bg-white/[0.06]', text: 'text-[#C4C9D2]' },
  OPERADOR_CAIXA: { label: 'Caixa',         Icon: ShoppingBag, ring: 'ring-white/15',      bg: 'bg-white/[0.06]', text: 'text-[#C4C9D2]' },
  ESTOQUISTA:     { label: 'Estoque',       Icon: Boxes,       ring: 'ring-white/15',      bg: 'bg-white/[0.06]', text: 'text-[#C4C9D2]' },
};
const roleUi = (nome: string) => ROLE_UI[nome] || { label: nome, Icon: UserIcon, ring: 'ring-white/15', bg: 'bg-white/[0.06]', text: 'text-[#C4C9D2]' };

/**
 * "Setor" que agrupa os perfis na tela de seleção. Hoje o setor é o próprio
 * cargo do usuário — assim, quando o admin cadastra a "Maria" como caixa, ela
 * aparece automaticamente no grupo "Caixa / Vendas". A ordem controla a posição
 * das seções na tela.
 */
const SETORES: Record<string, { label: string; ordem: number }> = {
  ADMIN:          { label: 'Administração', ordem: 1 },
  GERENTE:        { label: 'Gerência',      ordem: 2 },
  OPERADOR_CAIXA: { label: 'Caixa / Vendas', ordem: 3 },
  ESTOQUISTA:     { label: 'Estoque',       ordem: 4 },
};
const setorDoRole = (nome: string) => SETORES[nome] || { label: 'Outros', ordem: 99 };

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');

/** Mascara o CNPJ progressivamente (00.000.000/0001-00) para exibição. */
function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * fetch com timeout — evita que a tela fique presa em "Entrando..." para sempre
 * quando o servidor está lento ou fora do ar. Estoura em ~12s com erro amigável.
 */
async function fetchComTimeout(url: string, init?: RequestInit, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('O servidor demorou a responder. Verifique a conexão e tente de novo.');
    }
    throw new Error('Não foi possível falar com o servidor. Verifique a conexão e tente de novo.');
  } finally {
    clearTimeout(t);
  }
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type AtualizarStatus = (texto: string) => void;

/**
 * O backend pode estar adormecido no plano gratuito do host. Antes de enviar
 * credenciais, acorda a API por um endpoint público e leve. Enquanto isso a
 * tela permanece em estado de conexão, sem exibir um falso erro de login.
 */
async function aguardarServidor(atualizarStatus: AtualizarStatus, limiteMs = 75000): Promise<void> {
  const inicio = Date.now();
  let tentativa = 0;

  while (Date.now() - inicio < limiteMs) {
    tentativa += 1;
    atualizarStatus(tentativa === 1
      ? 'Conectando ao servidor seguro…'
      : 'O servidor está iniciando. Aguarde, isso pode levar até 1 minuto…');

    try {
      const res = await fetchComTimeout(`/api/v1/health/ready?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }, 15000);
      if (res.ok) {
        atualizarStatus('Servidor disponível. Validando seu acesso…');
        return;
      }
      // 4xx prova que o servidor respondeu; a chamada de login dará a mensagem
      // específica. 5xx/502/503/504 ainda podem ser o proxy durante o boot.
      if (res.status >= 400 && res.status < 500) return;
    } catch {
      // Rede/proxy ainda indisponível: tenta novamente até o limite global.
    }

    await esperar(2500);
  }

  throw new Error('O serviço não conseguiu iniciar. Verifique sua internet e tente novamente. Se persistir, contate o suporte.');
}

async function fetchComServidor(
  url: string,
  init: RequestInit,
  atualizarStatus: AtualizarStatus,
): Promise<Response> {
  await aguardarServidor(atualizarStatus);
  let res: Response;
  try {
    res = await fetchComTimeout(url, init, 20000);
  } catch {
    atualizarStatus('A conexão oscilou. Reconectando ao servidor…');
    await aguardarServidor(atualizarStatus);
    res = await fetchComTimeout(url, init, 20000);
  }

  // Se o proxy reiniciou entre o health check e o login, aquece uma vez e
  // repete. Login é idempotente para este fim e não cria registros financeiros.
  if ([502, 503, 504].includes(res.status)) {
    atualizarStatus('Reconectando ao servidor…');
    await aguardarServidor(atualizarStatus);
    res = await fetchComTimeout(url, init, 20000);
  }
  return res;
}

/**
 * Lê o corpo como JSON de forma segura. Se o servidor devolver algo que NÃO é
 * JSON (página de erro HTML, corpo vazio, proxy fora do ar enquanto o backend
 * sobe), nunca vaza o "Unexpected token < in JSON" para o caixa — lança uma
 * mensagem amigável. Em erro, extrai a mensagem do backend, que o Nest aninha
 * em `error.message` (ex.: "Senha incorreta.").
 */
async function lerJson(res: Response): Promise<any> {
  const texto = await res.text();
  let data: any = null;
  if (texto) {
    try { data = JSON.parse(texto); } catch { data = null; }
  }
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.message ||
      (res.status >= 500
        ? 'Não foi possível concluir após as tentativas automáticas. Verifique sua conexão e, se persistir, contate o suporte.'
        : 'Não foi possível concluir. Verifique os dados e tente de novo.');
    throw new Error(msg);
  }
  if (data === null) {
    throw new Error('O servidor demorou a responder direito. Tente de novo em instantes.');
  }
  return data;
}

/**
 * Wordmark "Lumin" idêntico ao do site (luminmkt.shop): lettering geométrico
 * arredondado (Comfortaa via .font-logo), o "i" sem pingo (ı) e um ponto azul
 * (#01B8FA) sobre a haste — o principal elemento de reconhecimento da marca.
 */
function Brand({ size = 'md' }: { size?: 'sm' | 'md'; inverted?: boolean }) {
  const px = size === 'sm' ? 18 : 24;
  const dot = Math.max(4, Math.round(px * 0.15));
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="font-logo inline-flex select-none items-baseline leading-none text-[#F7F8FA]"
        style={{ fontSize: px, fontWeight: 700, letterSpacing: '0.005em' }}
      >
        Lum
        <span className="relative inline-block">
          <span>ı</span>
          <span
            className="absolute rounded-full bg-[#01B8FA]"
            style={{
              width: dot,
              height: dot,
              left: '50%',
              transform: 'translateX(-50%)',
              top: `-${Math.round(px * 0.16)}px`,
              boxShadow: '0 0 12px 1px rgba(1,184,250,0.55)',
            }}
          />
        </span>
        n
      </span>
      <span className="font-plex-mono text-[9px] text-[#3DC8FB] tracking-[0.1em] uppercase">PDV &amp; Gestão</span>
    </div>
  );
}

export default function LoginPage() {
  const [hora, setHora] = useState(new Date());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('');

  // Estado de vínculo do computador.
  const [paired, setPaired] = useState<PairedTenant | null>(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(PAIR_KEY) || 'null');
      return salvo?.id && salvo?.nome && salvo?.token ? salvo : null;
    } catch { return null; }
  });

  // 'PAIR'   = liberar o computador (CNPJ + senha do admin)
  // 'DONO'   = acesso do dono da plataforma (e-mail + senha)
  // 'PICKER' = escolher o perfil (agrupado por setor)
  // 'SENHA'  = digitar a senha do perfil escolhido
  const [modo, setModo] = useState<'PAIR' | 'DONO' | 'PICKER' | 'SENHA'>(
    querAcessoDono() ? 'DONO' : paired ? 'PICKER' : 'PAIR',
  );
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
    if (modo === 'PICKER' && paired) carregarPerfis(paired.id, paired.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, paired?.id, paired?.token]);

  // Nunca deixa um "Entrando..." travado ao trocar de tela/perfil: cada vez que
  // o passo ou o perfil muda, zera o loading. Evita abrir o perfil já "entrando".
  useEffect(() => { setLoading(false); }, [modo, selecionado?.id]);

  async function carregarPerfis(tenantId: string, pairToken: string) {
    setCarregandoPerfis(true);
    setError('');
    try {
      const res = await fetchComServidor(`/api/v1/auth/users?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: { 'x-pair-token': pairToken },
      }, setServerStatus);
      const data = await lerJson(res);
      setPerfis(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar os perfis.');
    } finally {
      setCarregandoPerfis(false);
      setServerStatus('');
    }
  }

  /**
   * Grava a sessão no localStorage e redireciona. Por padrão vai para a tela
   * inicial do perfil; `destino` força uma rota (ex.: o dono da plataforma).
   */
  function entrar(data: any, destino?: string) {
    const authUser = { ...data.usuario, tenantId: data.tenant.id };
    const filiais = data.usuario.filiais || [];
    localStorage.setItem('wms_token', data.token);
    localStorage.setItem('wms_user', JSON.stringify(authUser));
    localStorage.setItem('wms_filiais', JSON.stringify(filiais));
    if (filiais[0]) localStorage.setItem('wms_filial', JSON.stringify(filiais[0]));
    let destinoFinal = destino || rotaInicial(data.usuario.telas, data.usuario.role, data.usuario.telaInicial);
    // Sem tela inicial fixada e empresa em modo Restaurante → cai no salão (mesas).
    if (!destino && destinoFinal === '/dashboard' && data.tenant?.modo === 'RESTAURANTE') {
      destinoFinal = '/restaurante/mesas';
    }
    window.location.href = destinoFinal;
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
    <div className="login-dark relative min-h-screen flex overflow-hidden bg-[#08090A] text-[#F7F8FA]">

      {/* Aura azul sutil da marca, atrás de tudo (igual ao hero do site). */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(1,184,250,0.14), transparent 70%), radial-gradient(40% 40% at 85% 10%, rgba(1,184,250,0.07), transparent 60%)',
        }}
      />

      {/* ═══════════ BANNER LATERAL ═══════════ */}
      <aside className="hidden lg:flex w-[38%] max-w-[520px] relative z-10 flex-col justify-between overflow-hidden border-r border-white/10 bg-[#0B0C0E] p-10">
        <Brand />

        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#01B8FA]" />
            <span className="font-plex-mono text-[11px] font-medium text-[#3DC8FB] uppercase tracking-[0.22em]">Ambiente seguro</span>
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.08]">
            Gestão simples<br />
            para quem precisa<br />
            <span className="text-[#01B8FA]">fazer acontecer.</span>
          </h1>
          <p className="text-[#9BA1AD] text-base mt-5 max-w-md leading-relaxed">
            PDV, estoque, compras, fiscal e financeiro reunidos em um ambiente consistente e preparado para a rotina da loja.
          </p>
        </div>

        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-white text-3xl font-plex-mono font-medium tabular-nums leading-none">
              {hora.toLocaleTimeString('pt-BR')}
            </p>
            <p className="text-[#6E7480] text-sm mt-1.5 capitalize">
              {hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[#6E7480] text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#01B8FA]" />
            Conexão protegida
          </div>
        </div>
      </aside>

      {/* ═══════════ ÁREA DIREITA ═══════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative z-10">
        <div className="lg:hidden mb-8">
          <Brand size="sm" />
        </div>

        {serverStatus && (
          <div role="status" className="mb-4 flex w-full max-w-sm items-center gap-3 rounded-xl border border-[#01B8FA]/30 bg-[#01B8FA]/10 px-4 py-3 text-sm text-[#3DC8FB]">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#01B8FA]/30 border-t-[#01B8FA]" />
            <span>{serverStatus}</span>
          </div>
        )}

        {modo === 'PAIR' && (
          <PairForm
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            setServerStatus={setServerStatus}
            onPaired={(tenant) => {
              const p = {
                id: tenant.id,
                nome: tenant.nomeFantasia || tenant.razaoSocial,
                token: tenant.token,
              };
              localStorage.setItem(PAIR_KEY, JSON.stringify(p));
              setPaired(p);
              setError('');
              setModo('PICKER'); // libera e mostra os perfis (não entra direto)
            }}
          />
        )}

        {modo === 'DONO' && (
          <OwnerForm
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            setServerStatus={setServerStatus}
            onVoltar={() => { setError(''); setModo('PAIR'); }}
            onEntrar={(data) => entrar(data, '/plataforma')}
          />
        )}

        {modo === 'PICKER' && paired && (
          <ProfilePicker
            tenantNome={paired.nome}
            perfis={perfis}
            carregando={carregandoPerfis}
            error={error}
            onSelecionar={(p) => { setSelecionado(p); setError(''); setModo('SENHA'); }}
            onDesvincular={desvincular}
          />
        )}

        {modo === 'SENHA' && selecionado && (
          <SenhaForm
            perfil={selecionado}
            loading={loading}
            error={error}
            setError={setError}
            onVoltar={() => { setSelecionado(null); setError(''); setModo('PICKER'); }}
            onEntrar={async (senha) => {
              if (loading) return; // evita envio duplicado (duplo clique / Enter repetido)
              setLoading(true);
              setError('');
              try {
                const res = await fetchComServidor('/api/v1/auth/login-por-id', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ usuarioId: selecionado.id, password: senha }),
                }, setServerStatus);
                const data = await lerJson(res);
                entrar(data);
              } catch (err: any) {
                setError(err.message || 'Não foi possível entrar.');
                setLoading(false);
              } finally {
                setServerStatus('');
              }
            }}
          />
        )}

        <p className="lg:hidden absolute bottom-5 text-[#6E7480] text-[11px]">
          Lumin PDV · Acesso restrito · v1.0.0
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 1 — Liberar o computador (CNPJ + senha do administrador)
──────────────────────────────────────────────────────────── */
function PairForm({ loading, setLoading, error, setError, setServerStatus, onPaired }: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  setServerStatus: AtualizarStatus;
  onPaired: (tenant: any) => void;
}) {
  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const cnpjRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => cnpjRef.current?.focus(), 100); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetchComServidor('/api/v1/auth/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: cnpj.trim(), senha }),
      }, setServerStatus);
      const data = await lerJson(res);
      onPaired({ ...data.tenant, token: data.pairToken });
    } catch (err: any) {
      setError(err.message);
      setSenha('');
      setLoading(false);
    } finally {
      setServerStatus('');
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#01B8FA]/10 border border-[#01B8FA]/25 px-3 py-1 mb-3">
          <Store className="h-3.5 w-3.5 text-[#01B8FA]" />
          <span className="font-plex-mono text-[11px] font-medium text-[#3DC8FB] uppercase tracking-wider">Liberar este computador</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-[#F7F8FA]">Acesse sua loja</h2>
        <p className="text-[#9BA1AD] text-sm mt-1">
          Informe o <b className="text-[#F7F8FA]">CNPJ</b> e a <b className="text-[#F7F8FA]">senha do administrador</b> <b className="text-[#F7F8FA]">uma vez</b>. Depois, cada pessoa entra pelo próprio perfil.
        </p>
      </div>

      <div className="relative bg-[#111214] border border-white/10 rounded-2xl p-6 space-y-4 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.65)]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block font-plex-mono text-[10px] font-medium text-[#9BA1AD] uppercase tracking-[0.1em] mb-1.5">CNPJ da loja</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7480]" />
              <input
                ref={cnpjRef}
                inputMode="numeric"
                maxLength={18}
                className="w-full bg-[#15171A] border border-white/15 text-[#F7F8FA] rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-[#6E7480] focus:outline-none focus:border-[#01B8FA] focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                required
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block font-plex-mono text-[10px] font-medium text-[#9BA1AD] uppercase tracking-[0.1em] mb-1.5">Senha do administrador</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7480]" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="w-full bg-[#15171A] border border-white/15 text-[#F7F8FA] rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-[#6E7480] focus:outline-none focus:border-[#01B8FA] focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
                placeholder="Senha do administrador..."
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E7480] hover:text-[#F7F8FA] transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span>✕</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !cnpj || !senha}
            className="w-full bg-[#01B8FA] hover:bg-[#3DC8FB] active:bg-[#019BD3] text-[#062B38] font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(1,184,250,0.65)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-[#062B38]/30 border-t-[#062B38] rounded-full" />
                Verificando...
              </span>
            ) : 'Liberar e ver perfis'}
          </button>
        </form>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-[#9BA1AD] text-xs">
          Ainda não tem uma conta?{' '}
          <a href={`${SITE_URL}/assinar.html`} className="text-[#01B8FA] hover:text-[#3DC8FB] font-semibold">
            Comece agora
          </a>
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   ACESSO DO DONO DA PLATAFORMA — e-mail + senha → /plataforma
──────────────────────────────────────────────────────────── */
function OwnerForm({ loading, setLoading, error, setError, setServerStatus, onVoltar, onEntrar }: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  setServerStatus: AtualizarStatus;
  onVoltar: () => void;
  onEntrar: (data: any) => void;
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
      const res = await fetchComServidor('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      }, setServerStatus);
      const data = await lerJson(res);
      if (!data.usuario?.isSuperAdmin) {
        setError('Este acesso não é de dono da plataforma. Use o acesso da loja.');
        setPassword('');
        setLoading(false);
        return;
      }
      onEntrar(data);
    } catch (err: any) {
      setError(err.message);
      setPassword('');
      setLoading(false);
    } finally {
      setServerStatus('');
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <button onClick={onVoltar} className="text-[#9BA1AD] hover:text-[#F7F8FA] text-sm inline-flex items-center gap-1.5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar para o acesso da loja
      </button>

      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#01B8FA]/10 border border-[#01B8FA]/25 px-3 py-1 mb-3">
          <Crown className="h-3.5 w-3.5 text-[#01B8FA]" />
          <span className="font-plex-mono text-[11px] font-medium text-[#3DC8FB] uppercase tracking-wider">Dono da plataforma</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-[#F7F8FA]">Painel da plataforma</h2>
        <p className="text-[#9BA1AD] text-sm mt-1">Acesso do administrador do SaaS — entra direto no painel.</p>
      </div>

      <div className="relative bg-[#111214] border border-white/10 rounded-2xl p-6 space-y-4 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.65)]">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block font-plex-mono text-[10px] font-medium text-[#9BA1AD] uppercase tracking-[0.1em] mb-1.5">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7480]" />
              <input
                ref={emailRef}
                type="email"
                className="w-full bg-[#15171A] border border-white/15 text-[#F7F8FA] rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-[#6E7480] focus:outline-none focus:border-[#01B8FA] focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
                placeholder="dono@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block font-plex-mono text-[10px] font-medium text-[#9BA1AD] uppercase tracking-[0.1em] mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7480]" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="w-full bg-[#15171A] border border-white/15 text-[#F7F8FA] rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-[#6E7480] focus:outline-none focus:border-[#01B8FA] focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
                placeholder="Digite sua senha..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E7480] hover:text-[#F7F8FA] transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span>✕</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-[#01B8FA] hover:bg-[#3DC8FB] active:bg-[#019BD3] text-[#062B38] font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(1,184,250,0.65)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-[#062B38]/30 border-t-[#062B38] rounded-full" />
                Verificando...
              </span>
            ) : 'Entrar no painel'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 2 — Escolher o perfil (cartões agrupados por setor)
──────────────────────────────────────────────────────────── */
function ProfilePicker({ tenantNome, perfis, carregando, error, onSelecionar, onDesvincular }: {
  tenantNome: string;
  perfis: Perfil[];
  carregando: boolean;
  error: string;
  onSelecionar: (p: Perfil) => void;
  onDesvincular: () => void;
}) {
  // Agrupa os perfis por setor (cargo) e ordena as seções.
  const grupos = Object.values(
    perfis.reduce((acc, p) => {
      const s = setorDoRole(p.role.nome);
      (acc[s.label] ??= { label: s.label, ordem: s.ordem, itens: [] }).itens.push(p);
      return acc;
    }, {} as Record<string, { label: string; ordem: number; itens: Perfil[] }>),
  ).sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#111214] border border-white/10 px-3 py-1 mb-3">
            <Store className="h-3.5 w-3.5 text-[#01B8FA]" />
            <span className="text-[11px] font-semibold text-[#C4C9D2] tracking-wide">{tenantNome}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-[#F7F8FA]">Quem vai usar agora?</h2>
          <p className="text-[#9BA1AD] text-sm mt-1">Selecione o seu perfil para entrar.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {carregando ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[#111214] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : perfis.length === 0 ? (
        <div className="text-[#9BA1AD] text-sm bg-[#111214] border border-white/10 rounded-2xl p-6 text-center">
          Nenhum perfil ativo encontrado nesta loja.
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.label} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="font-plex-mono text-[10px] font-semibold text-[#6E7480] uppercase tracking-[0.14em]">{g.label}</span>
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] text-[#6E7480]">{g.itens.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {g.itens.map((p) => {
                  const ui = roleUi(p.role.nome);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelecionar(p)}
                      className={`group relative flex flex-col items-center gap-3 rounded-2xl bg-[#111214] border border-white/10 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5 hover:border-[#01B8FA]/40 hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 ${ui.ring}`}
                    >
                      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${ui.bg} ring-1 ${ui.ring}`}>
                        <span className={`font-display text-lg font-bold ${ui.text}`}>{iniciais(p.nome)}</span>
                      </div>
                      <div className="text-center">
                        <p className="text-[#F7F8FA] text-sm font-semibold leading-tight line-clamp-1">{p.nome}</p>
                        <span className={`inline-flex items-center gap-1 mt-1 text-[11px] font-medium ${ui.text}`}>
                          <ui.Icon className="h-3 w-3" /> {ui.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center pt-2">
        <button onClick={onDesvincular} className="text-[#9BA1AD] hover:text-[#F7F8FA] text-xs inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Trocar de loja / desvincular este computador
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASSO 3 — Digitar a senha do perfil escolhido
──────────────────────────────────────────────────────────── */
function SenhaForm({ perfil, loading, error, setError, onVoltar, onEntrar }: {
  perfil: Perfil;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  onVoltar: () => void;
  onEntrar: (senha: string) => void;
}) {
  const ui = roleUi(perfil.role.nome);
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Limpa a senha quando dá erro, pra tentar de novo.
  useEffect(() => { if (error) setSenha(''); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-sm space-y-6">
      <button onClick={onVoltar} className="text-[#9BA1AD] hover:text-[#F7F8FA] text-sm inline-flex items-center gap-1.5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Trocar de perfil
      </button>

      {/* Cabeçalho do perfil selecionado */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${ui.bg} ring-1 ${ui.ring}`}>
          <span className={`font-display text-xl font-bold ${ui.text}`}>{iniciais(perfil.nome)}</span>
        </div>
        <div>
          <p className="text-[#F7F8FA] text-lg font-bold leading-tight">{perfil.nome}</p>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${ui.text}`}>
            <ui.Icon className="h-3.5 w-3.5" /> {ui.label}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (senha && !loading) onEntrar(senha); }}
        className="space-y-4"
      >
        <div>
          <label className="block font-plex-mono text-[10px] font-medium text-[#9BA1AD] uppercase tracking-[0.1em] mb-1.5">Senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7480]" />
            <input
              autoFocus
              type={showPwd ? 'text' : 'password'}
              className="w-full bg-[#15171A] border border-white/15 text-[#F7F8FA] rounded-xl px-4 py-3 pl-9 text-sm placeholder:text-[#6E7480] focus:outline-none focus:border-[#01B8FA] focus:ring-2 focus:ring-[#01B8FA]/20 transition-all"
              placeholder="Digite sua senha..."
              value={senha}
              onChange={(e) => { setError(''); setSenha(e.target.value); }}
              required
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E7480] hover:text-[#F7F8FA] transition-colors">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <span>✕</span> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !senha}
          className="w-full bg-[#01B8FA] hover:bg-[#3DC8FB] active:bg-[#019BD3] text-[#062B38] font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(1,184,250,0.65)]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-[#062B38]/30 border-t-[#062B38] rounded-full" /> Entrando...
            </span>
          ) : 'Entrar no Sistema'}
        </button>
      </form>
    </div>
  );
}
