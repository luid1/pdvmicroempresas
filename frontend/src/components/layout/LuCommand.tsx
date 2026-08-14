import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { podeVerTela, TELAS, type TelaDef } from '../../config/telas';
import { financeiroApi, iaApi, tesourariaApi, type ComandoLuResp } from '../../services/api';

/**
 * "Lu Command" — barra de comando (spotlight) da assistente. Abre com ⌘/Ctrl+K
 * ou pelo gatilho flutuante. Faz três coisas numa só barra:
 *   1. NAVEGAR   — casa a busca com as telas que o perfil pode ver (instantâneo,
 *                  sem IA). Enter numa sugestão abre a tela.
 *   2. PERGUNTAR — Enter no texto livre manda pra Lu, que responde sobre a loja.
 *   3. AGIR      — frases como "paguei 80 de luz" viram um rascunho de lançamento
 *                  que você confirma. A gravação passa pelo endpoint oficial de
 *                  tesouraria (mesmo guard) — a Lu só propõe.
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
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#0F8A72]/80 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

export default function LuCommand() {
  const { user, filialAtiva } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState(-1); // -1 = "perguntar à Lu"; >=0 = índice na lista de navegação
  const [acao, setAcao] = useState<Extract<ComandoLuResp, { tipo: 'acao' }> | null>(null);

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
        setMensagens((m) => [...m, { autor: 'lu', texto: 'Preparei este lançamento — confira e confirme. 👇' }]);
        setAcao(r);
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

  // Confirmação do lançamento gravou com sucesso → registra na conversa.
  const aposLancar = useCallback((resumo: string) => {
    setAcao(null);
    setMensagens((m) => [...m, { autor: 'lu', texto: `Pronto! ${resumo} lançado na Tesouraria. ✔️` }]);
  }, []);

  const podeLancar = podeVerTela(user?.telas, user?.role, '/financeiro/tesouraria') || podeVerTela(user?.telas, user?.role, '/financeiro/fluxo-caixa');
  const semThread = mensagens.length === 0;

  return createPortal(
    <>
      {/* Gatilho flutuante — orbe de IA com anel vivo. Elevado p/ não
          colidir com o botão "+" de cadastro (canto inferior direito). */}
      {!aberto && (
        <button
          onClick={abrir}
          title="Falar com a Lu  (Ctrl+K)"
          aria-label="Abrir a Lu (Ctrl+K)"
          className="group fixed bottom-[5.5rem] right-6 z-[60] transition-transform duration-300 hover:scale-[1.06] active:scale-95"
        >
          {/* glow que respira atrás do orbe */}
          <span className="lu-aura pointer-events-none" style={{ width: '150%', aspectRatio: '1' }} />
          <span className="lu-ring lu-orb grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_34px_rgba(15,138,114,0.35)]">
            <span className="grid h-[calc(100%-3px)] w-[calc(100%-3px)] place-items-center rounded-full bg-gradient-to-br from-[#20232F] to-[#12141C]">
              <Sparkles className="h-5 w-5 text-[#13A184] transition-transform duration-500 group-hover:rotate-[18deg]" />
            </span>
          </span>
          <span className="pointer-events-none absolute -top-1.5 -right-1 rounded-md bg-[#212121] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-[#13A184]/85 ring-1 ring-white/10">
            ⌘K
          </span>
        </button>
      )}

      {/* Spotlight */}
      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[8vh]">
          <div className="absolute inset-0 bg-[#202123]/25 animate-backdrop" onClick={fechar} />

          <div className="relative w-full max-w-2xl lu-rise">
            {/* Glow iridescente que respira atrás da barra */}
            <div className={`pointer-events-none lu-aura ${carregando ? 'is-thinking' : ''}`} />

            {/* Barra — moldura de gradiente vivo (âmbar → violeta) que orbita */}
            <div className={`lu-ring rounded-[20px] shadow-[0_28px_80px_-16px_rgba(22,23,29,0.4)] ${carregando ? 'is-thinking' : ''}`}>
              <form
                onSubmit={onSubmit}
                className="relative overflow-hidden rounded-[18.5px] bg-white/95 backdrop-blur-2xl"
              >
                {/* brilho superior sutil + varredura quando pensando */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#202123]/10 to-transparent" />
                {carregando && <span className="pointer-events-none absolute inset-0 lu-sweep" />}

                <div className="flex items-center gap-3.5 px-4 py-4">
                  <span className={`lu-ring ${carregando ? 'is-thinking lu-orb' : ''} grid h-10 w-10 shrink-0 place-items-center rounded-full`}>
                    <span className="grid h-[calc(100%-3px)] w-[calc(100%-3px)] place-items-center rounded-full bg-gradient-to-br from-[#20232F] to-[#12141C]">
                      {texto && sel < 0 ? <Search className="h-4 w-4 text-[#13A184]" /> : <Sparkles className="h-4 w-4 text-[#13A184]" />}
                    </span>
                  </span>
                  <input
                    ref={inputRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={carregando}
                    placeholder="Pergunte, lance ou encontre algo…"
                    className="flex-1 min-w-0 bg-transparent text-[18px] text-[#202123] placeholder:text-[#8E8F94] outline-none disabled:opacity-60"
                  />
                  {texto ? (
                    <button type="submit" disabled={carregando} title="Enviar" className="grid h-9 w-9 place-items-center rounded-xl bg-[#F7F7F8] text-[#5F6065] hover:bg-[#0F8A72]/20 hover:text-[#0B6F5C] disabled:opacity-40 transition-colors">
                      <Send className="h-4 w-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={fechar} title="Fechar (Esc)" className="grid h-9 w-9 place-items-center rounded-xl text-[#8E8F94] hover:bg-[#F7F7F8] hover:text-[#202123] transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Painel de resultados */}
            <div className="relative mt-2.5 overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white shadow-[0_24px_70px_-12px_rgba(22,23,29,0.28)]">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0F8A72]/30 to-transparent" />
              {acao ? (
                <FormLancamento
                  acao={acao}
                  filialId={filialAtiva?.id}
                  onCancelar={() => setAcao(null)}
                  onFeito={aposLancar}
                />
              ) : (
                <>
                  {/* Sugestões de navegação (aparecem enquanto digita) */}
                  {texto && (
                    <div className="p-1.5">
                      <button
                        onMouseEnter={() => setSel(-1)}
                        onClick={() => enviar()}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${sel < 0 ? 'bg-[#0F8A72]/[0.12]' : 'hover:bg-[#F7F7F8]'}`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0F8A72]/15 text-[#0F8A72]">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 min-w-0 truncate text-[13px] text-[#202123]">
                          Perguntar à Lu: <span className="text-[#8E8F94]">"{texto}"</span>
                        </span>
                        <CornerDownLeft className="h-3.5 w-3.5 text-[#C7C9D4]" />
                      </button>

                      {navMatches.map((t, i) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.key}
                            onMouseEnter={() => setSel(i)}
                            onClick={() => irPara(t.key)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${sel === i ? 'bg-[#0F8A72]/[0.12]' : 'hover:bg-[#F7F7F8]'}`}
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F7F7F8] text-[#5F6065]">
                              {Icon ? <Icon className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-[13px] text-[#202123]">{t.label}</span>
                            <span className="text-[10px] uppercase tracking-wide text-[#8E8F94]">{t.grupo}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Conversa */}
                  {mensagens.length > 0 && (
                    <div ref={threadRef} className="max-h-[54vh] overflow-y-auto px-4 py-3.5 space-y-3">
                      {mensagens.map((m, i) =>
                        m.autor === 'user' ? (
                          <div key={i} className="flex justify-end">
                            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#0F8A72]/[0.12] border border-[#0F8A72]/25 px-3 py-2 text-[13px] text-[#202123]">{m.texto}</div>
                          </div>
                        ) : (
                          <div key={i} className="flex justify-start">
                            <div className="max-w-[86%] rounded-2xl rounded-bl-sm bg-[#F7F7F8] border border-[#E5E7EB] px-3 py-2.5 text-[13px] text-[#202123] leading-relaxed whitespace-pre-line">{m.texto}</div>
                          </div>
                        ),
                      )}
                      {carregando && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-sm bg-[#F7F7F8] border border-[#E5E7EB] px-3 py-2.5">
                            <Digitando />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Estado inicial — atalhos de partida */}
                  {semThread && !texto && (
                    <div className="p-4">
                      <p className="mb-2.5 text-[11px] uppercase tracking-wide text-[#8E8F94]">Experimente</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Como estão minhas vendas?',
                          'O que está acabando no estoque?',
                          ...(podeLancar ? ['Paguei R$ 80 de conta de luz'] : []),
                        ].map((s) => (
                          <button
                            key={s}
                            onClick={() => { setTexto(s); setTimeout(() => inputRef.current?.focus(), 0); }}
                            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] text-[#5F6065] hover:bg-[#0F8A72]/[0.12] hover:border-[#0F8A72]/40 hover:text-[#0B6F5C] transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-[#8E8F94]">
                        <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#F7F7F8] px-1.5 py-0.5 text-[#5F6065] ring-1 ring-[#E5E7EB]">↑↓</kbd> navegar</span>
                        <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#F7F7F8] px-1.5 py-0.5 text-[#5F6065] ring-1 ring-[#E5E7EB]">↵</kbd> abrir / perguntar</span>
                        <span className="flex items-center gap-1.5"><kbd className="rounded bg-[#F7F7F8] px-1.5 py-0.5 text-[#5F6065] ring-1 ring-[#E5E7EB]">esc</kbd> fechar</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
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
function FormLancamento({
  acao,
  filialId,
  onCancelar,
  onFeito,
}: {
  acao: Extract<ComandoLuResp, { tipo: 'acao' }>;
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
        <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-gradient-to-br from-[#13A184] to-[#0F8A72] px-4 py-2 text-[13px] font-semibold text-[#202123] shadow-[0_6px_20px_rgba(15,138,114,0.35)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all">
          {salvando ? 'Lançando…' : 'Confirmar lançamento'}
        </button>
      </div>
    </div>
  );
}
