import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Barcode, CornerDownLeft, PackagePlus, Plus, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { podeVerTela, TELAS, type TelaDef } from '../../config/telas';
import api, { financeiroApi, iaApi, tesourariaApi, type ComandoLuResp } from '../../services/api';

/**
 * "Lu Command" — consulta autenticada do ERP. Abre com ⌘/Ctrl+K ou pelo
 * gatilho flutuante. Nesta fase faz duas coisas, sempre sem gravar dados:
 *   1. NAVEGAR   — casa a busca com as telas que o perfil pode ver (instantâneo,
 *                  sem IA). Enter numa sugestão abre a tela.
 *   2. PERGUNTAR — Enter no texto livre manda pra Lu, que responde sobre a loja.
 */

type Msg = { autor: 'user' | 'lu'; texto: string };
type ContaFin = { id: string; nome: string; padrao?: boolean };
type Categoria = { id: string; codigo: string; descricao: string };

/** Palavras-chave extras por rota, para casar a busca com o vocabulário do dono. */
const SINONIMOS: Record<string, string> = {
  '/pdv': 'caixa venda frente pdv vender',
  '/financeiro/pagar': 'gasto despesa boleto pagar conta fornecedor',
  '/financeiro/receber': 'receber cobrança fiado cliente',
  '/financeiro/fluxo-caixa': 'caixa dinheiro fluxo saldo',
  '/financeiro/tesouraria': 'tesouraria banco conta caixa lançamento',
  '/wms/pereciveis': 'validade vencendo vencimento perecivel flv',
  '/wms/posicao': 'estoque saldo posição quantidade',
  '/cadastros/produtos': 'produto item mercadoria codigo barras',
  '/cadastros/clientes': 'cliente fiado',
  '/cadastros/fornecedores': 'fornecedor',
  '/gerencial/relatorios': 'relatorio relatório análise',
};

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Três pontinhos enquanto a Lu pensa. */
function Digitando() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#01B8FA]/80 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

export default function LuCommand() {
  const { user, filialAtiva, segmento } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState(-1); // -1 = "perguntar à Lu"; >=0 = índice na lista de navegação

  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Catálogo de telas navegáveis que ESTE perfil pode ver (sem pastas/sintéticos).
  const telas = useMemo<TelaDef[]>(
    () =>
      TELAS.filter(
        (t) => !t.pasta && !t.key.startsWith('grupo:') && podeVerTela(user?.telas, user?.role, t.key),
      ),
    [user?.telas, user?.role],
  );

  // Sugestões de navegação para o texto atual (instantâneo, sem IA).
  const navMatches = useMemo(() => {
    const q = norm(texto);
    if (!q) return [] as TelaDef[];
    return telas
      .filter((t) => `${norm(t.label)} ${norm(t.grupo)} ${SINONIMOS[t.key] || ''}`.includes(q))
      .slice(0, 5);
  }, [texto, telas]);

  const fechar = useCallback(() => {
    setAberto(false);
    setSel(-1);
  }, []);

  const abrir = useCallback(() => {
    setAberto(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  // "Novo chat" — limpa a conversa e volta ao estado inicial.
  const novaConversa = useCallback(() => {
    setMensagens([]);
    setTexto('');
    setSel(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // ⌘/Ctrl+K abre/fecha de qualquer tela; Esc fecha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberto((a) => !a);
        setTimeout(() => inputRef.current?.focus(), 30);
      } else if (e.key === 'Escape' && aberto) {
        setAberto(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  // Rola a conversa para a última mensagem.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [mensagens, carregando]);

  // Mantém o índice destacado dentro do intervalo válido.
  useEffect(() => setSel(-1), [texto]);

  const irPara = useCallback(
    (rota: string) => {
      fechar();
      navigate(rota);
    },
    [fechar, navigate],
  );

  // Envia o texto livre para a Lu interpretar (perguntar OU agir).
  const enviar = useCallback(async () => {
    const q = texto.trim();
    if (!q || carregando) return;
    const historico = mensagens.slice(-6);
    setMensagens((m) => [...m, { autor: 'user', texto: q }]);
    setTexto('');
    setCarregando(true);
    try {
      const { data } = await iaApi.comando(q, historico, filialAtiva?.id);
      const r = data as ComandoLuResp;
      if (r.tipo === 'acao') {
        setMensagens((m) => [...m, { autor: 'lu', texto: 'Estou em modo somente consulta. Por enquanto não altero nem cadastro dados no ERP.' }]);
      } else {
        setMensagens((m) => [...m, { autor: 'lu', texto: r.texto || 'Não entendi dessa vez. Pode reformular?' }]);
      }
    } catch {
      setMensagens((m) => [...m, { autor: 'lu', texto: 'Não consegui processar agora. Tenta de novo em instantes.' }]);
    } finally {
      setCarregando(false);
    }
  }, [texto, carregando, mensagens, filialAtiva?.id]);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (sel >= 0 && navMatches[sel]) irPara(navMatches[sel].key);
      else enviar();
    },
    [sel, navMatches, irPara, enviar],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, navMatches.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, -1));
      }
    },
    [navMatches.length],
  );

  // Sugestões de partida adaptadas ao MODO DE OPERAÇÃO (mesmo motor da Lu; muda
  // só o vocabulário exemplificado). Restaurante fala de CMV, pratos e mesas.
  const ehRestaurante = segmento !== 'VAREJO';
  const sugestoesIniciais = ehRestaurante
    ? ['Qual meu prato mais vendido?', 'Qual prato está com o CMV mais alto?', 'Qual meu ticket médio?', 'Como está minha rentabilidade?']
    : ['Como estão minhas vendas?', 'O que está acabando no estoque?', 'Qual produto mais vendeu?', 'Como está minha rentabilidade?'];

  return createPortal(
    <>
      {/* Ícone discreto: fica no canto e não cobre o sidebar. Abre a Lu (Ctrl+K). */}
      {!aberto && (
        <button
          type="button"
          onClick={abrir}
          aria-label="Abrir a Lu (Ctrl+K)"
          title="Falar com a Lu — Ctrl+K"
          className="group fixed bottom-5 right-5 z-[60] grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#101216]/90 text-[#8A90A0] shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[#01B8FA]/50 hover:text-[#01B8FA] hover:shadow-[0_0_24px_-6px_rgba(1,184,250,0.6)] active:translate-y-0 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Sparkles className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-[18deg]" />
        </button>
      )}

      {/* Chat da Lu — janela única no padrão do dashboard */}
      {aberto && (
        <div className="theme-site fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[7vh]">
          <div className="absolute inset-0 bg-[#08090A]/70 backdrop-blur-[2px] animate-backdrop" onClick={fechar} />

          <div className="relative flex w-full max-w-xl max-h-[74vh] flex-col overflow-hidden rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_28px_80px_-16px_rgba(0,0,0,0.75)] lu-rise">
            {/* Cabeçalho — identidade da Lu + novo chat */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#23262F]">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#01B8FA]/25 bg-[#01B8FA]/[0.12] text-[#01B8FA] ${carregando ? 'animate-pulse' : ''}`}>
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 leading-none">
                <p className="text-[13px] font-semibold text-[#F7F8FA]">Lu</p>
                <p className="text-[10px] text-[#5E6472] mt-1">Assistente do ERP</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#01B8FA]/10 px-2 py-0.5 text-[9px] font-semibold text-[#22D3EE]">
                <ShieldCheck className="h-2.5 w-2.5" /> Somente consulta
              </span>
              {mensagens.length > 0 && (
                <button onClick={novaConversa} title="Novo chat" className="flex items-center gap-1 rounded-lg border border-[#23262F] px-2 py-1 text-[10px] font-medium text-[#8A90A0] hover:text-[#F7F8FA] hover:border-[#01B8FA]/40 transition-colors">
                  <Plus className="h-3 w-3" /> Novo chat
                </button>
              )}
              <button onClick={fechar} title="Fechar (Esc)" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#5E6472] hover:bg-white/[0.06] hover:text-[#F7F8FA] transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Corpo — conversa OU estado inicial */}
            <div ref={threadRef} className="flex-1 overflow-y-auto">
              {mensagens.length > 0 ? (
                <div className="px-4 py-3.5 space-y-3">
                  {mensagens.map((m, i) =>
                    m.autor === 'user' ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#01B8FA]/[0.14] border border-[#01B8FA]/30 px-3 py-2 text-[13px] text-[#F7F8FA]">{m.texto}</div>
                      </div>
                    ) : (
                      <div key={i} className="flex justify-start gap-2">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#01B8FA]/[0.12] text-[#01B8FA]"><Sparkles className="h-3 w-3" /></span>
                        <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-[#16181F] border border-[#23262F] px-3 py-2.5 text-[13px] text-[#E7E8EC] leading-relaxed whitespace-pre-line">{m.texto}</div>
                      </div>
                    ),
                  )}
                  {carregando && (
                    <div className="flex justify-start gap-2">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#01B8FA]/[0.12] text-[#01B8FA]"><Sparkles className="h-3 w-3" /></span>
                      <div className="rounded-2xl rounded-bl-sm bg-[#16181F] border border-[#23262F] px-3 py-2.5"><Digitando /></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-[#5E6472] mb-3">Experimente</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sugestoesIniciais.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setTexto(s); setTimeout(() => inputRef.current?.focus(), 0); }}
                        className="rounded-full border border-[#23262F] bg-[#16181F] px-3 py-1.5 text-[12px] text-[#8A90A0] hover:border-[#01B8FA]/40 hover:bg-[#01B8FA]/[0.10] hover:text-[#22D3EE] transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-[#5E6472]">
                    <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#16181F] px-1.5 py-0.5 text-[#8A90A0] ring-1 ring-[#23262F]">↑↓</kbd> navegar</span>
                    <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#16181F] px-1.5 py-0.5 text-[#8A90A0] ring-1 ring-[#23262F]">↵</kbd> abrir / perguntar</span>
                    <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#16181F] px-1.5 py-0.5 text-[#8A90A0] ring-1 ring-[#23262F]">esc</kbd> fechar</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sugestões de navegação — autocomplete acima do input */}
            {texto && (
              <div className="border-t border-[#23262F] p-1.5 max-h-52 overflow-y-auto">
                <button
                  onMouseEnter={() => setSel(-1)}
                  onClick={() => enviar()}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${sel < 0 ? 'bg-[#01B8FA]/[0.12]' : 'hover:bg-white/[0.04]'}`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#01B8FA]/15 text-[#01B8FA]"><Sparkles className="h-3.5 w-3.5" /></span>
                  <span className="flex-1 min-w-0 truncate text-[13px] text-[#F7F8FA]">Perguntar à Lu: <span className="text-[#8A90A0]">"{texto}"</span></span>
                  <CornerDownLeft className="h-3.5 w-3.5 text-[#5E6472]" />
                </button>
                {navMatches.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => irPara(t.key)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${sel === i ? 'bg-[#01B8FA]/[0.12]' : 'hover:bg-white/[0.04]'}`}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[#8A90A0]">
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-[13px] text-[#F7F8FA]">{t.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[#5E6472]">{t.grupo}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input (rodapé, estilo chat) */}
            <form onSubmit={onSubmit} className="border-t border-[#23262F] p-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-[#23262F] bg-[#0C0D10] pl-3 pr-2 py-1.5 transition-colors focus-within:border-[#01B8FA]/50">
                <span className="shrink-0 text-[#01B8FA]">
                  {texto && sel < 0 ? <Search className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </span>
                <input
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={carregando}
                  placeholder="Pergunte sobre os dados do ERP…"
                  className="flex-1 min-w-0 bg-transparent py-1 text-[15px] text-[#F7F8FA] placeholder:text-[#5E6472] outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={carregando || !texto.trim()}
                  title="Enviar"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#01B8FA] text-[#08090A] transition hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

/**
 * Formulário de confirmação do lançamento proposto pela Lu. Pré-preenchido com o
 * rascunho; a gravação chama o endpoint oficial de tesouraria (mesmo guard de
 * permissão e auditoria). A Lu nunca grava sozinha — você confirma aqui.
 */
function FormTransferencia({ acao, onCancelar, onFeito }: {
  acao: Extract<ComandoLuResp, { acao: 'transferir-estoque' }>;
  onCancelar: () => void;
  onFeito: (resumo: string) => void;
}) {
  const r = acao.rascunho;
  const [quantidade, setQuantidade] = useState(String(r.quantidade).replace('.', ','));
  const [observacoes, setObservacoes] = useState(r.observacoes || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const qtd = Number(quantidade.replace(',', '.'));
  const confirmar = async () => {
    if (!Number.isFinite(qtd) || qtd <= 0) return setErro('Informe uma quantidade maior que zero.');
    setErro(''); setSalvando(true);
    try {
      await api.post('/estoque/transferencias', { filialOrigemId: r.filialOrigemId, filialDestinoId: r.filialDestinoId, observacoes: observacoes.trim() || undefined, itens: [{ produtoId: r.produtoId, quantidade: qtd }] });
      onFeito(`Transferência de ${qtd.toLocaleString('pt-BR')} ${r.unidade} solicitada para ${r.filialDestinoNome}`);
    } catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível solicitar a transferência.'); }
    finally { setSalvando(false); }
  };
  return <div className="p-4">
    <div className="mb-3 flex items-center gap-2"><PackagePlus className="h-4 w-4 text-[#2F5FE0]" /><b className="text-[13px] text-[#202123]">Revisar transferência</b><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">aguarda sua confirmação</span></div>
    <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] px-3 py-3 text-[13px]"><b className="min-w-0 flex-1 truncate">{r.filialOrigemNome}</b><ArrowRight className="h-4 w-4 shrink-0 text-[#2F5FE0]" /><b className="min-w-0 flex-1 truncate text-right">{r.filialDestinoNome}</b></div>
    <div className="mt-3 rounded-xl border border-[#E5E7EB] p-3"><p className="text-[12px] font-semibold text-[#202123]">{r.produtoCodigo} · {r.produtoDescricao}</p><p className="mt-1 text-[11px] text-[#8E8F94]">Saldo disponível na origem: {r.saldoDisponivel.toLocaleString('pt-BR')} {r.unidade}</p></div>
    <div className="mt-3 grid gap-2.5 sm:grid-cols-[160px_1fr]"><label className="text-[11px] text-[#5F6065]">Quantidade<input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[13px] outline-none" /></label><label className="text-[11px] text-[#5F6065]">Observações (opcional)<input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[13px] outline-none" placeholder="Prioridade, transporte, conferência..." /></label></div>
    {qtd > r.saldoDisponivel && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">A quantidade é maior que o saldo atual. A solicitação pode ser criada, mas o despacho exigirá saldo suficiente.</p>}
    {erro && <p className="mt-2 text-[12px] text-[#c3352b]">{erro}</p>}
    <div className="mt-3.5 flex justify-end gap-2"><button onClick={onCancelar} disabled={salvando} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6065] hover:bg-[#F7F7F8]">Cancelar</button><button onClick={confirmar} disabled={salvando} className="rounded-lg bg-[#2F5FE0] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{salvando ? 'Solicitando…' : 'Confirmar transferência'}</button></div>
  </div>;
}

function FormProduto({ acao, onCancelar, onFeito }: {
  acao: Extract<ComandoLuResp, { acao: 'cadastrar-produto' }>;
  onCancelar: () => void;
  onFeito: (resumo: string) => void;
}) {
  const r = acao.rascunho;
  const [f, setF] = useState({ descricao: r.descricao, codigo: r.codigo || '', codigoBarras: r.codigoBarras || '', unidadeSigla: r.unidadeSigla || 'UN', ncm: r.ncm || '', categoria: r.categoria || '', precoCompra: r.precoCompra == null ? '' : String(r.precoCompra), precoVenda: r.precoVenda == null ? '' : String(r.precoVenda), estoqueMinimo: r.estoqueMinimo == null ? '' : String(r.estoqueMinimo), vendidoPorPeso: r.vendidoPorPeso });
  const set = (k: string, v: any) => setF((a) => ({ ...a, [k]: v }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const confirmar = async () => {
    if (!f.descricao.trim()) return setErro('Informe a descrição do produto.');
    const ncm = f.ncm.replace(/\D/g, '');
    if (ncm && ncm.length !== 8) return setErro('O NCM precisa ter 8 dígitos ou ficar vazio para completar depois.');
    setErro(''); setSalvando(true);
    try {
      await api.post('/produtos', { descricao: f.descricao.trim(), codigo: f.codigo.trim() || undefined, codigoBarras: f.codigoBarras.trim() || null, unidadeSigla: f.unidadeSigla, ncm: ncm || '00000000', categoria: f.categoria.trim() || null, precoCompra: f.precoCompra === '' ? null : Number(String(f.precoCompra).replace(',', '.')), precoVenda: f.precoVenda === '' ? null : Number(String(f.precoVenda).replace(',', '.')), estoqueMinimo: f.estoqueMinimo === '' ? null : Number(String(f.estoqueMinimo).replace(',', '.')), vendidoPorPeso: f.vendidoPorPeso });
      onFeito(`Produto ${f.descricao.trim()} cadastrado`);
    } catch (e: any) { setErro(e?.response?.data?.message || 'Não foi possível cadastrar o produto.'); }
    finally { setSalvando(false); }
  };
  const campo = (label: string, k: keyof typeof f, placeholder = '') => <label className="text-[11px] text-[#5F6065]">{label}<input value={String(f[k])} onChange={(e) => set(k, e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[13px] outline-none" placeholder={placeholder} /></label>;
  return <div className="p-4">
    <div className="mb-3 flex items-center gap-2"><Barcode className="h-4 w-4 text-[#2F5FE0]" /><b className="text-[13px] text-[#202123]">Revisar novo produto</b><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">rascunho da Lu</span></div>
    <div className="grid gap-2.5 sm:grid-cols-2">{campo('Descrição *', 'descricao')}{campo('SKU / código interno', 'codigo', 'Automático se vazio')}{campo('Código de barras / GTIN', 'codigoBarras')}{campo('NCM', 'ncm', '8 dígitos; pode completar depois')}{campo('Categoria', 'categoria')}<label className="text-[11px] text-[#5F6065]">Unidade<select value={f.unidadeSigla} onChange={(e) => set('unidadeSigla', e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[13px] outline-none">{['UN', 'KG', 'CX', 'PC', 'LT', 'ML'].map((u) => <option key={u}>{u}</option>)}</select></label>{campo('Preço de compra', 'precoCompra')}{campo('Preço de venda', 'precoVenda')}{campo('Estoque mínimo', 'estoqueMinimo')}<label className="flex items-end gap-2 pb-2 text-[12px] text-[#5F6065]"><input type="checkbox" checked={f.vendidoPorPeso} onChange={(e) => set('vendidoPorPeso', e.target.checked)} /> Vendido por peso</label></div>
    {!f.ncm && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">O produto será salvo com NCM provisório 00000000. Complete a classificação fiscal antes de emitir nota.</p>}
    {erro && <p className="mt-2 text-[12px] text-[#c3352b]">{erro}</p>}
    <div className="mt-3.5 flex justify-end gap-2"><button onClick={onCancelar} disabled={salvando} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6065] hover:bg-[#F7F7F8]">Cancelar</button><button onClick={confirmar} disabled={salvando} className="rounded-lg bg-[#2F5FE0] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{salvando ? 'Cadastrando…' : 'Cadastrar produto'}</button></div>
  </div>;
}

function FormLancamento({
  acao,
  filialId,
  onCancelar,
  onFeito,
}: {
  acao: Extract<ComandoLuResp, { acao: 'lancar-gasto' | 'lancar-entrada' }>;
  filialId?: string;
  onCancelar: () => void;
  onFeito: (resumo: string) => void;
}) {
  const r = acao.rascunho;
  const saida = r.tipoMovimento === 'SAIDA';
  const [valor, setValor] = useState(String(r.valor).replace('.', ','));
  const [descricao, setDescricao] = useState(r.descricao);
  const [data, setData] = useState(r.data);
  const [contaId, setContaId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [contas, setContas] = useState<ContaFin[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    tesourariaApi.contas().then((res: any) => {
      const lista: ContaFin[] = res.data || [];
      setContas(lista);
      const padrao = lista.find((c) => c.padrao) || lista[0];
      if (padrao) setContaId(padrao.id);
    }).catch(() => setContas([]));

    financeiroApi.planoContas.analiticas().then((res: any) => {
      const lista: Categoria[] = res.data || [];
      setCategorias(lista);
      // Pré-seleciona a categoria que a Lu inferiu, casando pela descrição.
      if (r.categoriaTexto) {
        const alvo = norm(r.categoriaTexto);
        const achou = lista.find((c) => norm(c.descricao).includes(alvo) || alvo.includes(norm(c.descricao)));
        if (achou) setCategoria(achou.codigo);
      }
    }).catch(() => setCategorias([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmar = async () => {
    const v = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor maior que zero.'); return; }
    if (!contaId) { setErro('Escolha a conta.'); return; }
    if (!descricao.trim()) { setErro('Descreva o lançamento.'); return; }
    setErro('');
    setSalvando(true);
    try {
      await tesourariaApi.movimentoAvulso({
        contaId,
        tipo: r.tipoMovimento,
        valor: v,
        descricao: descricao.trim(),
        data,
        ...(categoria ? { planoContasCodigo: categoria } : {}),
        ...(filialId ? { filialId } : {}),
      });
      onFeito(`${saida ? 'Gasto' : 'Entrada'} de ${brl(v)}`);
    } catch (e: any) {
      setErro(e?.response?.data?.error?.message || e?.response?.data?.message || 'Não consegui lançar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${saida ? 'bg-[#E0483D]/12 text-[#c3352b]' : 'bg-[#0FA968]/12 text-[#0b7d4e]'}`}>
          {saida ? 'Saída' : 'Entrada'}
        </span>
        <span className="text-[13px] font-medium text-[#202123]">{acao.acao === 'lancar-gasto' ? 'Lançar gasto' : 'Lançar entrada'} na Tesouraria</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-1 text-[11px] text-[#5F6065]">
          Valor
          <div className="mt-1 flex items-center rounded-lg border border-[#E5E7EB] bg-white px-2.5">
            <span className="text-[12px] text-[#8E8F94]">R$</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="w-full bg-transparent px-1.5 py-2 text-[14px] text-[#202123] outline-none" />
          </div>
        </label>
        <label className="col-span-1 text-[11px] text-[#5F6065]">
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[13px] text-[#202123] outline-none [color-scheme:light]" />
        </label>
        <label className="col-span-2 text-[11px] text-[#5F6065]">
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[13px] text-[#202123] outline-none" />
        </label>
        <label className="col-span-1 text-[11px] text-[#5F6065]">
          Conta
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-[13px] text-[#202123] outline-none">
            <option value="">Selecione…</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.padrao ? ' (padrão)' : ''}</option>)}
          </select>
        </label>
        <label className="col-span-1 text-[11px] text-[#5F6065]">
          Categoria <span className="text-[#8E8F94]">(opcional)</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-[13px] text-[#202123] outline-none">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.codigo}>{c.codigo} · {c.descricao}</option>)}
          </select>
        </label>
      </div>

      {erro && <p className="mt-2.5 text-[12px] text-[#c3352b]">{erro}</p>}

      <div className="mt-3.5 flex items-center justify-end gap-2">
        <button onClick={onCancelar} disabled={salvando} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6065] hover:bg-[#F7F7F8] disabled:opacity-40 transition-colors">Cancelar</button>
        <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-gradient-to-br from-[#5B7BF0] to-[#2F5FE0] px-4 py-2 text-[13px] font-semibold text-[#202123] shadow-[0_6px_20px_rgba(47,95,224,0.35)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all">
          {salvando ? 'Lançando…' : 'Confirmar lançamento'}
        </button>
      </div>
    </div>
  );
}
