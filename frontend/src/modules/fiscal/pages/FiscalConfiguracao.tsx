import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, EyeOff, FileKey, RefreshCw, Save, ShieldCheck, TestTube2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../../components/ui/feedback';
import { btnGlass } from '../../cadastros/ui';

const input = 'mt-1 h-10 w-full rounded-lg border border-[#23262F] bg-[#101216] px-3 text-[13px] text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:ring-4 focus:ring-[#01B8FA]/10 [color-scheme:dark]';

export default function FiscalConfiguracao({ embedded = false }: { embedded?: boolean } = {}) {
  const { filiais, filialAtiva, refreshFiliais } = useAuth();
  const [filialId, setFilialId] = useState(filialAtiva?.id || '');
  const [config, setConfig] = useState<any>(null);
  const [form, setForm] = useState<any>({ provedor: 'FOCUS_NFE', ambiente: 'HOMOLOGACAO', ativo: false, baseUrl: '', token: '', cscId: '', csc: '', serieNfe: '1', serieNfce: '1', removerToken: false, removerCsc: false });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => { void refreshFiliais().catch(() => {}); }, [refreshFiliais]);
  useEffect(() => { if (!filialId && filialAtiva?.id) setFilialId(filialAtiva.id); }, [filialId, filialAtiva?.id]);

  const carregar = useCallback(async () => {
    if (!filialId) { setLoading(false); return; }
    setLoading(true); setErro('');
    try {
      const { data } = await api.get(`/nfe/configuracao/${filialId}`);
      setConfig(data);
      setForm({
        provedor: data.provedor || 'FOCUS_NFE', ambiente: data.ambiente || 'HOMOLOGACAO', ativo: !!data.ativo,
        baseUrl: data.baseUrl || '', token: '', cscId: data.cscId || '', csc: '', serieNfe: data.serieNfe || '1', serieNfce: data.serieNfce || '1',
        removerToken: false, removerCsc: false,
      });
    } catch (e: any) { setErro(e.response?.data?.message || 'Falha ao consultar a configuração fiscal.'); }
    finally { setLoading(false); }
  }, [filialId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = async () => {
    if (!filialId) return;
    setSalvando(true); setErro('');
    try {
      const { data } = await api.put(`/nfe/configuracao/${filialId}`, form);
      setConfig(data); setForm((f: any) => ({ ...f, token: '', csc: '', removerToken: false, removerCsc: false }));
      toast('Configuração fiscal salva com segurança.');
      await carregar();
    } catch (e: any) { setErro(e.response?.data?.message || 'Não foi possível salvar a configuração fiscal.'); }
    finally { setSalvando(false); }
  };

  const validar = async () => {
    if (!filialId) return;
    setValidando(true); setErro('');
    try {
      const { data } = await api.post(`/nfe/configuracao/${filialId}/validar`);
      setConfig(data);
      const msg = data.conexao?.mensagem || (data.ok ? 'Conexão validada com o provedor.' : `Pendências: ${(data.pendencias || []).join(', ')}.`);
      toast(msg, data.ok ? 'success' : 'info');
    } catch (e: any) { setErro(e.response?.data?.message || 'Falha ao validar a configuração.'); }
    finally { setValidando(false); }
  };

  const adapterDisponivel = form.provedor === 'FOCUS_NFE';
  const pronto = config?.statusConexao === 'PRONTO_HOMOLOGACAO';
  return <div className={embedded ? '' : 'min-h-full bg-[#0C0D10] p-4 sm:p-5'}><div className={embedded ? 'space-y-4 pb-24' : 'mx-auto max-w-6xl space-y-4 pb-24'}>
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${embedded ? 'sm:justify-end' : 'sm:justify-between'}`}>
      {!embedded && <div><h1 className="text-xl font-semibold text-[#F7F8FA]">Central Fiscal</h1><p className="mt-1 text-xs text-[#8A90A0]">Cole o token, teste a conexão e ative — o PDV e o atacado passam a emitir sozinhos.</p></div>}
      <div className="flex min-w-0 items-center gap-2"><select value={filialId} onChange={(e) => setFilialId(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#23262F] bg-[#101216] px-3 text-xs text-[#F7F8FA] [color-scheme:dark] sm:w-72">{filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>)}</select><button onClick={carregar} className={`${btnGlass} shrink-0`}><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
    </div>

    {erro && <div className="rounded-xl border border-[#FF6B7A]/30 bg-[#FF6B7A]/10 p-4 text-sm text-[#FF6B7A]">{erro}</div>}
    {!filialId ? <div className="rounded-xl border border-[#FF9F45]/30 bg-[#FF9F45]/10 p-5 text-sm text-[#FF9F45]">Cadastre ou selecione uma filial antes de configurar a emissão fiscal.</div> : loading ? <div className="rounded-xl border border-[#23262F] bg-[#101216] p-8 text-center text-sm text-[#8A90A0]">Carregando configuração…</div> : <>
      <div className="grid gap-2 sm:grid-cols-4">{[
        ['1', 'Cole o token', 'Token da Focus NFe no campo abaixo'],
        ['2', 'Salve', 'Guardamos cifrado, por filial'],
        ['3', 'Teste a conexão', 'Batemos no provedor de verdade'],
        ['4', 'Ative', 'PDV e atacado emitem sozinhos'],
      ].map(([n, t, d]) => <div key={n} className="rounded-xl border border-[#23262F] bg-[#101216] p-3"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#01B8FA] text-[10px] font-bold text-[#04121A]">{n}</span><p className="text-xs font-semibold text-[#F7F8FA]">{t}</p></div><p className="mt-1 text-[11px] text-[#8A90A0]">{d}</p></div>)}</div>

      <div className={`rounded-2xl border p-4 ${pronto ? 'border-[#2DD4A7]/30 bg-[#2DD4A7]/10' : 'border-[#FF9F45]/30 bg-[#FF9F45]/10'}`}><div className="flex items-start gap-3">{pronto ? <CheckCircle2 className="h-6 w-6 text-[#2DD4A7]" /> : <AlertTriangle className="h-6 w-6 text-[#FF9F45]" />}<div><h2 className="font-semibold text-[#F7F8FA]">{pronto ? 'Pronta para iniciar homologação' : 'Emissão real permanece bloqueada'}</h2><p className="mt-1 text-xs text-[#8A90A0]">{config?.mensagemStatus || 'Salve os dados e valide os requisitos antes de qualquer transmissão.'}</p></div></div></div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Cloud className="h-5 w-5 text-[#01B8FA]" /><h2 className="font-semibold text-[#F7F8FA]">Provedor e ambiente</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-medium text-[#8A90A0]">Provedor<select value={form.provedor} onChange={(e) => { set('provedor', e.target.value); if (e.target.value !== 'FOCUS_NFE') set('ativo', false); }} className={input}><option value="FOCUS_NFE">Focus NFe</option><option value="BUGGY">Buggy / gateway futuro</option><option value="OUTRO">Outro provedor</option></select></label>
            <label className="text-[11px] font-medium text-[#8A90A0]">Ambiente<select value={form.ambiente} onChange={(e) => set('ambiente', e.target.value)} className={input}><option value="HOMOLOGACAO">Homologação</option><option value="PRODUCAO">Produção</option></select></label>
            <label className="text-[11px] font-medium text-[#8A90A0] sm:col-span-2">URL base personalizada <span className="font-normal text-[#8A90A0]/70">(opcional)</span><input value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} className={input} placeholder="Vazia = endereço oficial do ambiente selecionado" /></label>
            <label className="text-[11px] font-medium text-[#8A90A0]">Série NF-e<input value={form.serieNfe} onChange={(e) => set('serieNfe', e.target.value)} className={input} /></label>
            <label className="text-[11px] font-medium text-[#8A90A0]">Série NFC-e<input value={form.serieNfce} onChange={(e) => set('serieNfce', e.target.value)} className={input} /></label>
          </div>
          {!adapterDisponivel && <p className="mt-3 rounded-lg bg-[#01B8FA]/10 px-3 py-2 text-xs text-[#01B8FA]">A estrutura está pronta para guardar este provedor, mas o adaptador da API precisa da documentação oficial antes de ser ativado.</p>}
          {form.ambiente === 'PRODUCAO' && <p className="mt-3 rounded-lg bg-[#FF6B7A]/10 px-3 py-2 text-xs font-medium text-[#FF6B7A]">Produção gera documentos com validade fiscal. Ative somente depois de concluir os cenários de homologação.</p>}
        </div>

        <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><FileKey className="h-5 w-5 text-[#01B8FA]" /><h2 className="font-semibold text-[#F7F8FA]">Credenciais protegidas</h2></div>
          <label className="text-[11px] font-medium text-[#8A90A0]">Token do provedor<input type="password" autoComplete="new-password" value={form.token} onChange={(e) => set('token', e.target.value)} className={input} placeholder={config?.tokenConfigurado ? 'Configurado — deixe vazio para manter' : 'Cole o token da homologação'} /></label>
          <div className="mt-3 grid grid-cols-[110px_1fr] gap-2"><label className="text-[11px] font-medium text-[#8A90A0]">ID do CSC<input value={form.cscId} onChange={(e) => set('cscId', e.target.value)} className={input} /></label><label className="text-[11px] font-medium text-[#8A90A0]">CSC da NFC-e<input type="password" autoComplete="new-password" value={form.csc} onChange={(e) => set('csc', e.target.value)} className={input} placeholder={config?.cscConfigurado ? 'Configurado — deixe vazio para manter' : 'Código de segurança'} /></label></div>
          <div className="mt-3 space-y-1.5 text-[11px] text-[#8A90A0]"><p className="flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" /> Tokens nunca retornam para o navegador depois de salvos.</p><label className="flex items-center gap-2"><input type="checkbox" checked={form.removerToken} onChange={(e) => set('removerToken', e.target.checked)} /> Remover token salvo</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.removerCsc} onChange={(e) => set('removerCsc', e.target.checked)} /> Remover CSC salvo</label></div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#F7F8FA]">Ativação controlada</h2><p className="mt-1 text-xs text-[#8A90A0]">Salvar não transmite notas. A emissão continua passando pelas validações fiscais e pelo ambiente escolhido.</p></div><label className="flex shrink-0 items-center gap-2 rounded-full bg-[#0C0D10] border border-[#23262F] px-3 py-2 text-xs font-medium text-[#F7F8FA]"><input type="checkbox" checked={!!form.ativo} disabled={!adapterDisponivel} onChange={(e) => set('ativo', e.target.checked)} /> Usar esta configuração</label></div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={validar} disabled={validando || !config?.id} className={btnGlass}><TestTube2 className="h-4 w-4" /> {validando ? 'Testando…' : 'Testar conexão'}</button><button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-[#01B8FA] px-4 py-2 text-xs font-semibold text-[#04121A] disabled:opacity-50"><Save className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar configuração'}</button></div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">{[[ShieldCheck, 'Filial emitente', config?.filial?.cnpj ? 'CNPJ configurado' : 'CNPJ pendente'], [FileKey, 'Token', config?.tokenConfigurado ? 'Protegido e configurado' : 'Pendente'], [Cloud, 'Status', config?.statusConexao || 'PENDENTE']].map(([Icon, l, v]: any) => <div key={l} className="rounded-xl border border-[#23262F] bg-[#101216] p-4"><Icon className="h-5 w-5 text-[#01B8FA]" /><p className="mt-3 text-[10px] uppercase tracking-wide text-[#8A90A0]">{l}</p><p className="mt-1 text-sm font-semibold text-[#F7F8FA]">{String(v).replace(/_/g, ' ')}</p></div>)}</div>
    </>}
  </div></div>;
}
