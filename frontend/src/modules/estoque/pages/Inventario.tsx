import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, ArrowLeft, Lock, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, TableCard, Th, Modal, Campo, Loader, Vazio, inp } from '../../cadastros/ui';

const num = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const STATUS_COR: Record<string, string> = { EM_CONTAGEM: 'bg-amber-500/15 text-amber-400', FECHADO: 'bg-emerald-500/15 text-emerald-400', ABERTO: 'bg-sky-500/15 text-sky-400' };

export default function Inventario() {
  const { filialAtiva } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/inventario').then(r => setLista(r.data)).catch(() => setLista([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (abertoId) return <Contagem id={abertoId} onVoltar={() => { setAbertoId(null); carregar(); }} />;

  return (
    <CadastroShell>
      <TopBar icon={<ClipboardList className="h-5 w-5" />} titulo="Inventário" subtitulo={`${lista.length} contagem(ns)`}
        novoLabel="Novo Inventário" onNovo={() => setNovo(true)}
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-lg text-slate-200 text-sm"><RefreshCw className="h-4 w-4 text-sky-400" /> Atualizar</button>} />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<ClipboardList className="h-10 w-10" />} texto="Nenhum inventário. Clique em Novo Inventário para começar a contagem." /> : (
          <TableCard>
            <thead><tr>{['Descrição', 'Filial', 'Início', 'Fim', 'Itens', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(iv => (
                <tr key={iv.id} className="border-t border-slate-800 hover:bg-sky-500/5">
                  <td className="px-3 py-2.5 font-semibold text-slate-100">{iv.descricao}</td>
                  <td className="px-3 py-2.5 text-slate-300">{iv.filial?.nome || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400">{dt(iv.dataInicio)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{dt(iv.dataFim)}</td>
                  <td className="px-3 py-2.5 text-center text-slate-300">{iv._count?.itens ?? '—'}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[iv.status] || 'bg-slate-700'}`}>{iv.status}</span></td>
                  <td className="px-3 py-2.5"><button onClick={() => setAbertoId(iv.id)} className="text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-1 rounded font-semibold hover:bg-sky-500/20">{iv.status === 'FECHADO' ? 'Ver' : 'Contar'}</button></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {novo && <ModalNovo filialId={filialAtiva?.id} onClose={() => setNovo(false)} onCriado={(id) => { setNovo(false); carregar(); setAbertoId(id); }} />}
    </CadastroShell>
  );
}

function ModalNovo({ filialId, onClose, onCriado }: { filialId?: string; onClose: () => void; onCriado: (id: string) => void }) {
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Carrega só as categorias que existem de verdade (evita filtrar por uma sem produtos)
  useEffect(() => {
    api.get('/produtos/categorias').then(r => setCategorias(r.data || [])).catch(() => setCategorias([]));
  }, []);
  const abrir = async () => {
    setSalvando(true); setErro('');
    try {
      const { data } = await api.post('/inventario', { filialId, descricao: descricao || undefined, categoria: categoria || undefined });
      onCriado(data.id);
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao abrir inventário.'); setSalvando(false); }
  };
  return (
    <Modal titulo="Novo Inventário" onClose={onClose} onSalvar={abrir} salvando={salvando} salvarLabel="Abrir contagem">
      <p className="text-sm text-slate-400">Ao abrir, o sistema congela o saldo atual de cada produto como base da contagem.</p>
      <Campo label="Descrição"><input value={descricao} onChange={e => setDescricao(e.target.value)} className={inp} placeholder="Ex: Contagem semanal FLV" /></Campo>
      <Campo label="Categoria (opcional — filtra os produtos)">
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inp}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      {erro && <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">{erro}</p>}
    </Modal>
  );
}

function Contagem({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [inv, setInv] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [fechando, setFechando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get(`/inventario/${id}`).then(r => {
      setInv(r.data);
      const c: Record<string, string> = {};
      r.data.itens.forEach((it: any) => { if (it.quantidadeContada !== null) c[it.id] = String(it.quantidadeContada); });
      setContagens(c);
    }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarItem = async (itemId: string) => {
    const v = contagens[itemId];
    if (v === undefined || v === '') return;
    try { await api.patch(`/inventario/item/${itemId}/contar`, { quantidadeContada: Number(v) }); carregar(); } catch {/*noop*/}
  };
  const fechar = async () => {
    if (!await confirmDialog('Fechar o inventário e gerar os ajustes de estoque das diferenças?')) return;
    setFechando(true);
    try { const { data } = await api.post(`/inventario/${id}/fechar`); toast(`Inventário fechado. ${data.ajustesGerados} ajuste(s) gerado(s).`); onVoltar(); }
    catch (e: any) { toast(e.response?.data?.message || 'Erro ao fechar.'); setFechando(false); }
  };

  const fechado = inv?.status === 'FECHADO';

  return (
    <CadastroShell>
      <TopBar icon={<ClipboardList className="h-5 w-5" />} titulo={inv?.descricao || 'Inventário'} subtitulo={`${inv?.filial?.nome || ''} · ${inv?.itens?.length || 0} itens · ${inv?.status || ''}`}
        extra={<div className="flex items-center gap-2">
          <button onClick={onVoltar} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-lg text-slate-200 text-sm"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          {!fechado && <button onClick={fechar} disabled={fechando} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40"><Lock className="h-4 w-4" /> Fechar & gerar ajustes</button>}
        </div>} />

      <div className="flex-1 overflow-auto p-4">
        {loading || !inv ? <Loader /> : (
          <TableCard>
            <thead><tr>{['Produto', 'Un', 'Sistema', 'Contagem física', 'Diferença', fechado ? 'Ajuste' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {inv.itens.map((it: any) => {
                const contada = contagens[it.id];
                const dif = contada !== undefined && contada !== '' ? Number(contada) - Number(it.quantidadeSistema) : (it.diferenca ?? null);
                return (
                  <tr key={it.id} className="border-t border-slate-800">
                    <td className="px-3 py-2"><p className="font-semibold text-slate-100">{it.produto?.descricao}</p><p className="text-slate-500 text-xs font-mono">{it.produto?.codigo}</p></td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{it.produto?.unidadeMedida?.sigla || 'UN'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{num(it.quantidadeSistema)}</td>
                    <td className="px-3 py-2 text-right">
                      {fechado ? <span className="font-mono text-slate-200">{num(it.quantidadeContada)}</span> : (
                        <input type="number" value={contagens[it.id] ?? ''} onChange={e => setContagens(p => ({ ...p, [it.id]: e.target.value }))}
                          onBlur={() => salvarItem(it.id)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100 w-24 text-right focus:border-sky-500" placeholder="—" />
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${dif == null ? 'text-slate-500' : dif === 0 ? 'text-slate-400' : dif > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{dif == null ? '—' : (dif > 0 ? '+' : '') + num(dif)}</td>
                    {fechado && <td className="px-3 py-2">{it.ajusteGerado ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <span className="text-slate-600 text-xs">—</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        )}
        {!fechado && !loading && <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1"><Save className="h-3 w-3" /> A contagem salva sozinha ao sair do campo. Ao fechar, cada diferença vira um ajuste de estoque (+/−).</p>}
      </div>
    </CadastroShell>
  );
}
