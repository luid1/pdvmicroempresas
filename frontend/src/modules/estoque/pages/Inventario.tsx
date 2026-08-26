import { toast, confirmDialog } from '../../../components/ui/feedback';
import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, ArrowLeft, Lock, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { CadastroShell, TopBar, TableCard, Th, Modal, Campo, Loader, Vazio, inp } from '../../cadastros/ui';

const num = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dt = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
const STATUS_COR: Record<string, string> = { EM_CONTAGEM: 'bg-[#FF9F45]/12 text-[#FF9F45]', FECHADO: 'bg-[#2DD4A7]/12 text-[#2DD4A7]', ABERTO: 'bg-[#16181F] text-[#8A90A0]' };

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
        extra={<button onClick={carregar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-1.5 rounded-lg text-[#8A90A0] text-sm"><RefreshCw className="h-4 w-4 text-[#01B8FA]" /> Atualizar</button>} />

      <div className="flex-1 overflow-auto p-4">
        {loading ? <Loader /> : lista.length === 0 ? <Vazio icon={<ClipboardList className="h-10 w-10" />} texto="Nenhum inventário. Clique em Novo Inventário para começar a contagem." /> : (
          <TableCard>
            <thead><tr>{['Descrição', 'Filial', 'Início', 'Fim', 'Itens', 'Status', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {lista.map(iv => (
                <tr key={iv.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                  <td className="px-3 py-1 font-semibold text-[#F7F8FA]">{iv.descricao}</td>
                  <td className="px-3 py-1 text-[#8A90A0]">{iv.filial?.nome || '—'}</td>
                  <td className="px-3 py-1 text-slate-400">{dt(iv.dataInicio)}</td>
                  <td className="px-3 py-1 text-slate-400">{dt(iv.dataFim)}</td>
                  <td className="px-3 py-1 text-center text-[#8A90A0]">{iv._count?.itens ?? '—'}</td>
                  <td className="px-3 py-1"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COR[iv.status] || 'bg-[#16181F] text-[#8A90A0]'}`}>{iv.status}</span></td>
                  <td className="px-3 py-1"><button onClick={() => setAbertoId(iv.id)} className="text-[11px] bg-[#01B8FA]/12 text-[#01B8FA] border border-[#01B8FA]/30 px-2 py-1 rounded font-semibold hover:bg-[#01B8FA]/20">{iv.status === 'FECHADO' ? 'Ver' : 'Contar'}</button></td>
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
      {erro && <p className="text-xs text-[#FF6B7A] bg-rose-500/10 px-3 py-1.5 rounded-lg">{erro}</p>}
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
          <button onClick={onVoltar} className="flex items-center gap-1.5 bg-[#101216] border border-[#23262F] hover:bg-[#0C0D10] px-3 py-1.5 rounded-lg text-[#8A90A0] text-sm"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          {!fechado && <button onClick={fechar} disabled={fechando} className="flex items-center gap-1.5 bg-[#2DD4A7] hover:bg-[#26BE95] text-[#04121A] px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40"><Lock className="h-4 w-4" /> Fechar & gerar ajustes</button>}
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
                  <tr key={it.id} className="border-t border-[#23262F] hover:bg-white/[0.03]">
                    <td className="px-3 py-1.5"><p className="font-semibold text-[12.5px] leading-tight text-[#F7F8FA] truncate max-w-[280px]">{it.produto?.descricao}</p><p className="text-slate-500 text-[10.5px] font-mono leading-tight">{it.produto?.codigo}</p></td>
                    <td className="px-3 py-1.5 text-slate-400 text-xs">{it.produto?.unidadeMedida?.sigla || 'UN'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[#8A90A0]">{num(it.quantidadeSistema)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {fechado ? <span className="font-mono text-[#F7F8FA]">{num(it.quantidadeContada)}</span> : (
                        <input type="number" value={contagens[it.id] ?? ''} onChange={e => setContagens(p => ({ ...p, [it.id]: e.target.value }))}
                          onBlur={() => salvarItem(it.id)} className="bg-[#101216] border border-[#23262F] rounded px-2 py-1 text-sm text-[#F7F8FA] w-24 text-right focus:border-[#01B8FA]" placeholder="—" />
                      )}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${dif == null ? 'text-slate-500' : dif === 0 ? 'text-slate-400' : dif > 0 ? 'text-[#2DD4A7]' : 'text-[#FF6B7A]'}`}>{dif == null ? '—' : (dif > 0 ? '+' : '') + num(dif)}</td>
                    {fechado && <td className="px-3 py-1.5">{it.ajusteGerado ? <CheckCircle2 className="h-4 w-4 text-[#2DD4A7]" /> : <span className="text-slate-600 text-xs">—</span>}</td>}
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
