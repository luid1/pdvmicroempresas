import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Scale, Plus, RefreshCw, Trash2, X, Sparkles, Pencil, Building2, Save } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { PageHeader, btnGlass, btnPrimary } from '../../cadastros/ui';

type Regra = {
  id?: string;
  descricao: string;
  ncm?: string | null;
  ufDestino?: string | null;
  tipoOperacao: string;
  consumidorFinal?: boolean | null;
  cfopInterno: string;
  cfopInterestadual: string;
  cstIcms: string;
  origemProd: string;
  aliquotaIcms: number;
  reducaoBaseIcms: number;
  temSt: boolean;
  mvaSt: number;
  aliquotaIcmsSt: number;
  temDifal: boolean;
  cstIpi?: string | null;
  aliquotaIpi: number;
  cstPis: string;
  aliquotaPis: number;
  cstCofins: string;
  aliquotaCofins: number;
  prioridade: number;
  ativo: boolean;
};

const VAZIA: Regra = {
  descricao: '', ncm: '', ufDestino: '', tipoOperacao: 'VENDA', consumidorFinal: null,
  cfopInterno: '5102', cfopInterestadual: '6102', cstIcms: '102', origemProd: '0',
  aliquotaIcms: 0, reducaoBaseIcms: 0, temSt: false, mvaSt: 0, aliquotaIcmsSt: 0, temDifal: false,
  cstIpi: '', aliquotaIpi: 0, cstPis: '07', aliquotaPis: 0, cstCofins: '07', aliquotaCofins: 0,
  prioridade: 0, ativo: true,
};

export default function MatrizFiscal({ embedded = false }: { embedded?: boolean } = {}) {
  const { filialAtiva } = useAuth();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Regra | null>(null);
  // Config fiscal da filial emitente
  const [filial, setFilial] = useState<any | null>(null);
  const [salvandoFilial, setSalvandoFilial] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/fiscal/regras').then(r => setRegras(r.data)).catch(() => setRegras([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!filialAtiva) return;
    api.get('/filiais').then(r => setFilial((r.data || []).find((f: any) => f.id === filialAtiva.id) || null)).catch(() => {});
  }, [filialAtiva?.id]);

  const salvarFilial = async () => {
    if (!filial) return;
    setSalvandoFilial(true);
    try {
      await api.patch(`/filiais/${filial.id}/regime`, {
        regimeTributario: filial.regimeTributario, crt: filial.crt, cnpj: filial.cnpj, ie: filial.ie,
      });
    } catch (e: any) { toast(e.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSalvandoFilial(false); }
  };

  const salvar = async () => {
    if (!edit) return;
    const body = { ...edit, ncm: edit.ncm || null, ufDestino: edit.ufDestino || null, cstIpi: edit.cstIpi || null };
    try {
      if (edit.id) await api.put(`/fiscal/regras/${edit.id}`, body);
      else await api.post('/fiscal/regras', body);
      setEdit(null); carregar();
    } catch (e: any) { toast(e.response?.data?.message || 'Erro ao salvar.'); }
  };
  const remover = async (id: string) => {
    if (!await confirmDialog('Remover esta regra fiscal?')) return;
    await api.delete(`/fiscal/regras/${id}`); carregar();
  };
  const semear = async () => {
    const { data } = await api.post('/fiscal/regras/seed');
    if (data.jaExistiam) toast('A matriz já tem regras — nada foi criado.');
    carregar();
  };

  const actions = (
    <>
      {regras.length === 0 && (
        <button onClick={semear} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#01B8FA]/12 border border-[#01B8FA]/40 text-[#01B8FA] hover:bg-[#01B8FA]/20 transition-all duration-300 active:scale-[0.98]">
          <Sparkles className="h-3.5 w-3.5" /> Regras-padrão
        </button>
      )}
      <button onClick={carregar} className={btnGlass}>
        <RefreshCw className="h-3.5 w-3.5" /> Atualizar
      </button>
      <button onClick={() => setEdit({ ...VAZIA })} className={btnPrimary}>
        <Plus className="h-3.5 w-3.5" /> Nova regra
      </button>
    </>
  );

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>
      {!embedded && (
        <PageHeader
          icon={<Scale className="h-4 w-4" />}
          titulo="Matriz Fiscal"
          subtitulo={`${regras.length} regra(s) — CFOP, CST/CSOSN e alíquotas por NCM/UF/operação`}
          actions={actions}
        />
      )}

      <div className={embedded ? 'space-y-4' : 'flex-1 overflow-auto p-4 space-y-4'}>
        {embedded && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#8A90A0]">{regras.length} regra(s) — CFOP, CST/CSOSN e alíquotas por NCM/UF/operação</p>
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          </div>
        )}
        {/* Config fiscal da filial emitente */}
        {filial && (
          <div className="bg-[#101216] rounded-xl border border-[#23262F] p-4">
            <h3 className="font-bold text-sm text-[#F7F8FA] mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-[#01B8FA]" /> Filial emitente — {filial.nome}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm items-end">
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#8A90A0]">Regime tributário</span>
                <select value={filial.regimeTributario || 'SIMPLES_NACIONAL'} onChange={e => setFilial({ ...filial, regimeTributario: e.target.value })} className={inp}>
                  <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                  <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                  <option value="LUCRO_REAL">Lucro Real</option>
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#8A90A0]">CRT</span>
                <select value={filial.crt || '1'} onChange={e => setFilial({ ...filial, crt: e.target.value })} className={inp}>
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples (excesso sublimite)</option>
                  <option value="3">3 — Regime Normal</option>
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#8A90A0]">CNPJ</span>
                <input value={filial.cnpj || ''} onChange={e => setFilial({ ...filial, cnpj: e.target.value })} className={inp} />
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#8A90A0]">Inscrição Estadual</span>
                <input value={filial.ie || ''} onChange={e => setFilial({ ...filial, ie: e.target.value })} className={inp} />
              </label>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={salvarFilial} disabled={salvandoFilial} className="flex items-center gap-1.5 bg-[#01B8FA] hover:bg-[#01B8FA]/90 text-[#04121A] px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40">
                <Save className="h-4 w-4" /> {salvandoFilial ? 'Salvando…' : 'Salvar dados da filial'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin h-6 w-6 border-2 border-[#01B8FA] border-t-transparent rounded-full" /></div>
        ) : regras.length === 0 ? (
          <div className="text-center text-[#8A90A0] py-16">
            <Scale className="h-10 w-10 mx-auto mb-2 text-[#23262F]" />
            Nenhuma regra fiscal. Clique em <b>Regras-padrão</b> para começar (FLV/Simples) ou crie uma nova.
          </div>
        ) : (
          <div className="bg-[#101216] rounded-xl border border-[#23262F] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>{['Descrição', 'NCM', 'UF dest.', 'Operação', 'CFOP int/inter', 'CST', 'ICMS', 'PIS/COFINS', 'ST/DIFAL', 'Prio', ''].map(h => <th key={h} className="px-3 py-1.5 text-left font-semibold text-[#8A90A0] text-[10px] uppercase tracking-[0.08em] bg-[#0C0D10] border-b border-[#23262F] whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {regras.map(r => (
                  <tr key={r.id} className={`border-t border-[#23262F] hover:bg-white/[0.03] ${!r.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-[#F7F8FA]">{r.descricao}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#F7F8FA]">{r.ncm || <span className="text-[#8A90A0]">*</span>}</td>
                    <td className="px-3 py-2 text-[#F7F8FA]">{r.ufDestino || <span className="text-[#8A90A0]">*</span>}</td>
                    <td className="px-3 py-2 text-xs text-[#F7F8FA]">{r.tipoOperacao}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#F7F8FA]">{r.cfopInterno} / {r.cfopInterestadual}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#F7F8FA]">{r.cstIcms}</td>
                    <td className="px-3 py-2 text-xs text-[#F7F8FA]">{Number(r.aliquotaIcms)}%</td>
                    <td className="px-3 py-2 text-xs text-[#F7F8FA]">{Number(r.aliquotaPis)}/{Number(r.aliquotaCofins)}%</td>
                    <td className="px-3 py-2 text-xs text-[#F7F8FA]">{r.temSt ? `ST ${Number(r.mvaSt)}%` : ''}{r.temDifal ? ' DIFAL' : ''}{!r.temSt && !r.temDifal ? '—' : ''}</td>
                    <td className="px-3 py-2 text-center text-[#F7F8FA]">{r.prioridade}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEdit({ ...r, ncm: r.ncm || '', ufDestino: r.ufDestino || '', cstIpi: r.cstIpi || '' })} className="text-[#8A90A0] hover:text-[#01B8FA] p-1" title="Editar"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remover(r.id!)} className="text-[#8A90A0] hover:text-[#FF6B7A] p-1" title="Remover"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && createPortal((
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-backdrop" onClick={() => setEdit(null)}>
          <div className="bg-[#101216] border border-[#23262F] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto animate-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#23262F] sticky top-0 bg-[#101216] z-10">
              <h2 className="font-bold text-[#F7F8FA]">{edit.id ? 'Editar' : 'Nova'} regra fiscal</h2>
              <button onClick={() => setEdit(null)}><X className="h-5 w-5 text-[#8A90A0] hover:text-[#F7F8FA]" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 text-sm">
              <L className="col-span-2" label="Descrição"><input value={edit.descricao} onChange={e => setEdit({ ...edit, descricao: e.target.value })} className={inp} /></L>
              <L label="NCM (vazio = qualquer)"><input value={edit.ncm || ''} onChange={e => setEdit({ ...edit, ncm: e.target.value })} className={inp} placeholder="ex: 0701" /></L>
              <L label="UF destino (vazio = qualquer)"><input value={edit.ufDestino || ''} maxLength={2} onChange={e => setEdit({ ...edit, ufDestino: e.target.value.toUpperCase() })} className={inp} placeholder="ex: SP" /></L>
              <L label="Tipo de operação">
                <select value={edit.tipoOperacao} onChange={e => setEdit({ ...edit, tipoOperacao: e.target.value })} className={inp}>
                  {['VENDA', 'DEVOLUCAO', 'TRANSFERENCIA', 'BONIFICACAO'].map(o => <option key={o}>{o}</option>)}
                </select>
              </L>
              <L label="Consumidor final">
                <select value={edit.consumidorFinal === null ? '' : String(edit.consumidorFinal)} onChange={e => setEdit({ ...edit, consumidorFinal: e.target.value === '' ? null : e.target.value === 'true' })} className={inp}>
                  <option value="">Qualquer</option><option value="true">Sim</option><option value="false">Não (contribuinte)</option>
                </select>
              </L>
              <L label="CFOP interno"><input value={edit.cfopInterno} onChange={e => setEdit({ ...edit, cfopInterno: e.target.value })} className={inp} /></L>
              <L label="CFOP interestadual"><input value={edit.cfopInterestadual} onChange={e => setEdit({ ...edit, cfopInterestadual: e.target.value })} className={inp} /></L>
              <L label="CST/CSOSN ICMS"><input value={edit.cstIcms} onChange={e => setEdit({ ...edit, cstIcms: e.target.value })} className={inp} /></L>
              <L label="Origem produto"><input value={edit.origemProd} onChange={e => setEdit({ ...edit, origemProd: e.target.value })} className={inp} /></L>
              <L label="Alíquota ICMS %"><input type="number" step="0.01" value={edit.aliquotaIcms} onChange={e => setEdit({ ...edit, aliquotaIcms: +e.target.value })} className={inp} /></L>
              <L label="Redução base ICMS %"><input type="number" step="0.01" value={edit.reducaoBaseIcms} onChange={e => setEdit({ ...edit, reducaoBaseIcms: +e.target.value })} className={inp} /></L>
              <L label="Alíquota PIS %"><input type="number" step="0.01" value={edit.aliquotaPis} onChange={e => setEdit({ ...edit, aliquotaPis: +e.target.value })} className={inp} /></L>
              <L label="Alíquota COFINS %"><input type="number" step="0.01" value={edit.aliquotaCofins} onChange={e => setEdit({ ...edit, aliquotaCofins: +e.target.value })} className={inp} /></L>
              <L className="col-span-2" label="">
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={edit.temSt} onChange={e => setEdit({ ...edit, temSt: e.target.checked })} /> Tem ICMS-ST</label>
                  {edit.temSt && <>
                    <span>MVA% <input type="number" step="0.01" value={edit.mvaSt} onChange={e => setEdit({ ...edit, mvaSt: +e.target.value })} className="bg-[#101216] border border-[#23262F] text-[#F7F8FA] rounded px-2 py-1 w-20 outline-none focus:border-[#01B8FA]/60" /></span>
                    <span>Alíq ST% <input type="number" step="0.01" value={edit.aliquotaIcmsSt} onChange={e => setEdit({ ...edit, aliquotaIcmsSt: +e.target.value })} className="bg-[#101216] border border-[#23262F] text-[#F7F8FA] rounded px-2 py-1 w-20 outline-none focus:border-[#01B8FA]/60" /></span>
                  </>}
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={edit.temDifal} onChange={e => setEdit({ ...edit, temDifal: e.target.checked })} /> Tem DIFAL</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={edit.ativo} onChange={e => setEdit({ ...edit, ativo: e.target.checked })} /> Ativa</label>
                  <span>Prioridade <input type="number" value={edit.prioridade} onChange={e => setEdit({ ...edit, prioridade: +e.target.value })} className="bg-[#101216] border border-[#23262F] text-[#F7F8FA] rounded px-2 py-1 w-16 outline-none focus:border-[#01B8FA]/60" /></span>
                </div>
              </L>
            </div>
            <div className="px-5 py-3 border-t border-[#23262F] flex justify-end gap-2 sticky bottom-0 bg-[#101216]">
              <button onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg border border-[#23262F] text-[#8A90A0] text-sm hover:bg-white/[0.03] hover:text-[#F7F8FA]">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#01B8FA]/90 text-[#04121A] font-bold text-sm">Salvar</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

const inp = 'bg-[#101216] border border-[#23262F] rounded-lg px-2 py-1.5 text-sm w-full text-[#F7F8FA] outline-none transition-all focus:border-[#01B8FA]/60 focus:ring-4 focus:ring-[#01B8FA]/10 [color-scheme:dark]';
function L({ label, children, className = '' }: { label: string; children: any; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className}`}>{label && <span className="text-xs font-semibold text-[#8A90A0]">{label}</span>}{children}</label>;
}
