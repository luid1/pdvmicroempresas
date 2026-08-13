import { useState } from 'react';
import {
  Settings, Building2, Receipt, SlidersHorizontal, Plug, Info,
  Save, Check, Warehouse, User, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { CadastroShell, TopBar, inp, lbl } from '../../cadastros/ui';
import { toast } from '../../../components/ui/feedback';

type SecaoKey = 'empresa' | 'fiscal' | 'preferencias' | 'integracoes' | 'sistema';

interface Config {
  regimeTributario: string;
  ambienteNFe: string;
  serieNFe: string;
  proximoNumero: string;
  itensPorPagina: string;
  moeda: string;
  focusToken: string;
  anthropicKey: string;
}

const PADRAO: Config = {
  regimeTributario: 'SIMPLES',
  ambienteNFe: 'homologacao',
  serieNFe: '1',
  proximoNumero: '1',
  itensPorPagina: '50',
  moeda: 'BRL',
  focusToken: '',
  anthropicKey: '',
};

function carregar(): Config {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem('wms_config') || '{}') }; }
  catch { return PADRAO; }
}

const SECOES: { key: SecaoKey; label: string; icon: React.ElementType }[] = [
  { key: 'empresa', label: 'Empresa & Filiais', icon: Building2 },
  { key: 'fiscal', label: 'Fiscal / NF-e', icon: Receipt },
  { key: 'preferencias', label: 'Preferências', icon: SlidersHorizontal },
  { key: 'integracoes', label: 'Integrações', icon: Plug },
  { key: 'sistema', label: 'Sistema', icon: Info },
];

export default function Configuracoes() {
  const { user, filiais, filialAtiva } = useAuth();
  const [secao, setSecao] = useState<SecaoKey>('empresa');
  const [cfg, setCfg] = useState<Config>(carregar);
  const [salvo, setSalvo] = useState(false);

  const set = (k: keyof Config, v: string) => { setCfg((c) => ({ ...c, [k]: v })); setSalvo(false); };

  const salvar = () => {
    localStorage.setItem('wms_config', JSON.stringify(cfg));
    setSalvo(true);
    toast('Configurações salvas.', 'success');
    setTimeout(() => setSalvo(false), 2500);
  };

  const podeSalvar = secao === 'fiscal' || secao === 'preferencias' || secao === 'integracoes';

  return (
    <CadastroShell>
      <TopBar
        icon={<Settings className="h-4 w-4" />}
        titulo="Configurações"
        subtitulo="Parâmetros da empresa, fiscais e do sistema"
        extra={podeSalvar ? (
          <button onClick={salvar}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-lg shadow-amber-500/20 transition-all duration-300 active:scale-[0.98]">
            {salvo ? <><Check className="h-3.5 w-3.5" /> Salvo</> : <><Save className="h-3.5 w-3.5" /> Salvar</>}
          </button>
        ) : undefined}
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Sub-navegação de seções */}
        <nav className="w-56 shrink-0 border-r border-[#E7E5DF] p-3 space-y-1 overflow-y-auto">
          {SECOES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSecao(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-300 active:scale-[0.98] ${
                secao === key ? 'bg-amber-400/[0.12] text-[#a9760a] border border-[#E8A317]/40' : 'text-slate-400 hover:bg-[#F6F5F2] hover:text-[#16171D] border border-transparent'
              }`}>
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
          {secao === 'empresa' && (
            <Bloco titulo="Empresa & Filiais" desc="Dados do tenant e das filiais/boxes ativas (somente leitura).">
              <div className="grid grid-cols-2 gap-4">
                <Leitura icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Tenant ID" valor={user?.tenantId || '—'} mono />
                <Leitura icon={<User className="h-3.5 w-3.5" />} label="Usuário logado" valor={`${user?.nome || '—'} (${user?.role || '—'})`} />
              </div>
              <p className={`${lbl} mt-6`}>Filiais / Boxes ({filiais.length})</p>
              <div className="space-y-2">
                {filiais.map((f) => (
                  <div key={f.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                    f.id === filialAtiva?.id ? 'bg-amber-400/[0.08] border-[#E8A317]/40' : 'bg-[#F6F5F2] border-[#E7E5DF]'
                  }`}>
                    <Warehouse className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[#5B5D69] text-sm font-medium truncate">{f.codigo} — {f.nome}</p>
                    </div>
                    {f.id === filialAtiva?.id && <span className="ml-auto text-[10px] font-bold text-[#a9760a] uppercase tracking-wide">Ativa</span>}
                  </div>
                ))}
                {filiais.length === 0 && <p className="text-slate-500 text-sm">Nenhuma filial vinculada.</p>}
              </div>
            </Bloco>
          )}

          {secao === 'fiscal' && (
            <Bloco titulo="Fiscal / NF-e" desc="Parâmetros de emissão de documentos fiscais.">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Regime tributário">
                  <select className={inp} value={cfg.regimeTributario} onChange={(e) => set('regimeTributario', e.target.value)}>
                    <option value="SIMPLES">Simples Nacional</option>
                    <option value="PRESUMIDO">Lucro Presumido</option>
                    <option value="REAL">Lucro Real</option>
                  </select>
                </Campo>
                <Campo label="Ambiente NF-e">
                  <select className={inp} value={cfg.ambienteNFe} onChange={(e) => set('ambienteNFe', e.target.value)}>
                    <option value="homologacao">Homologação (teste)</option>
                    <option value="producao">Produção</option>
                  </select>
                </Campo>
                <Campo label="Série da NF-e"><input className={inp} value={cfg.serieNFe} onChange={(e) => set('serieNFe', e.target.value)} /></Campo>
                <Campo label="Próximo número"><input className={inp} value={cfg.proximoNumero} onChange={(e) => set('proximoNumero', e.target.value)} /></Campo>
              </div>
              {cfg.ambienteNFe === 'producao' && (
                <div className="mt-4 flex items-start gap-2 text-[#a9760a] bg-amber-500/[0.08] border border-[#E8A317]/40 rounded-xl px-4 py-3 text-xs">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  Ambiente de <b>produção</b>: as NF-e emitidas têm valor fiscal e são transmitidas à SEFAZ.
                </div>
              )}
            </Bloco>
          )}

          {secao === 'preferencias' && (
            <Bloco titulo="Preferências" desc="Ajustes de exibição do sistema.">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Itens por página (listas)"><input className={inp} value={cfg.itensPorPagina} onChange={(e) => set('itensPorPagina', e.target.value)} /></Campo>
                <Campo label="Moeda">
                  <select className={inp} value={cfg.moeda} onChange={(e) => set('moeda', e.target.value)}>
                    <option value="BRL">Real (R$)</option>
                    <option value="USD">Dólar (US$)</option>
                  </select>
                </Campo>
              </div>
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F6F5F2] border border-[#E7E5DF]">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <p className="text-[#8B8D98] text-sm">Tema <b>Dark Tech</b> — padrão do sistema.</p>
              </div>
            </Bloco>
          )}

          {secao === 'integracoes' && (
            <Bloco titulo="Integrações" desc="Chaves e tokens de serviços externos. Guardadas neste navegador.">
              <Campo label="Focus NFe — Token">
                <input type="password" className={inp} value={cfg.focusToken} onChange={(e) => set('focusToken', e.target.value)} placeholder="Token da API Focus NFe" />
              </Campo>
              <Campo label="Anthropic — API Key (interpretador de pedidos)" className="mt-4">
                <input type="password" className={inp} value={cfg.anthropicKey} onChange={(e) => set('anthropicKey', e.target.value)} placeholder="sk-ant-..." />
              </Campo>
              <div className="mt-4 flex items-start gap-2 text-slate-400 bg-[#F6F5F2] border border-[#E7E5DF] rounded-xl px-4 py-3 text-xs">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Para produção, os tokens sensíveis devem ficar no <code className="text-[#8B8D98]">.env</code> do backend. Estes campos são um atalho de teste no cliente.
              </div>
            </Bloco>
          )}

          {secao === 'sistema' && (
            <Bloco titulo="Sistema" desc="Informações da instalação.">
              <div className="grid grid-cols-2 gap-4">
                <Leitura label="Versão" valor="Mercado PDV v1.0.0" />
                <Leitura label="Ambiente" valor="Desenvolvimento" />
                <Leitura label="API" valor="/api/v1" mono />
                <Leitura label="Filial ativa" valor={filialAtiva ? `${filialAtiva.codigo} — ${filialAtiva.nome}` : '—'} />
              </div>
            </Bloco>
          )}
        </div>
      </div>
    </CadastroShell>
  );
}

function Bloco({ titulo, desc, children }: { titulo: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="text-lg font-bold text-[#16171D] tracking-tight">{titulo}</h2>
      <p className="text-slate-500 text-sm mt-0.5 mb-5">{desc}</p>
      {children}
    </div>
  );
}

function Campo({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className={lbl}>{label}</label>{children}</div>;
}

function Leitura({ icon, label, valor, mono }: { icon?: React.ReactNode; label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <label className={`${lbl} flex items-center gap-1.5`}>{icon}{label}</label>
      <div className={`w-full bg-[#F6F5F2] border border-[#E7E5DF] rounded-lg px-3 py-2 text-sm text-[#8B8D98] ${mono ? 'font-mono text-[12px]' : ''} truncate`}>{valor}</div>
    </div>
  );
}
