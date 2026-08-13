import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode, Trash2, Plus, Minus, ShoppingCart, CreditCard,
  Banknote, QrCode, X, Check, ScanLine, LogOut, Loader2,
  ArrowDownCircle, ArrowUpCircle, Lock, Printer, Percent, Coins, Scale,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { pdvApi } from '../../../services/api';
import {
  AbrirCaixa, ModalValor, ModalFechar, RelatorioZ, SessaoRel,
} from '../components/CaixaSessao';
import { getTefProvider, type CanalPagamento } from '../tef/tef';
import { beepOk, beepErro } from '../som';
import { imprimirCupom, getCupomAuto, setCupomAuto, type CupomImpressao } from '../cupom';
import { abrirGavetaAuto, abrirGavetaManual } from '../gaveta';

/**
 * Tela de Frente de Caixa (PDV) — passa mercadorias por código de barras,
 * consultando os produtos reais do banco e registrando a venda (baixa de
 * estoque + entrada no caixa) via endpoints /pdv/*.
 */

type ItemVenda = {
  produtoId: string;
  codigoBarras: string;
  descricao: string;
  precoUnit: number;
  unidade: string;
  quantidade: number;
};

// Produto retornado pela busca por nome/código (autocomplete do caixa).
type ProdutoBusca = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  descricao: string;
  unidade: string;
  vendidoPorPeso: boolean;
  precoVenda: number;
  estoqueDisponivel: number;
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type PagamentoEnvio = {
  forma: string;
  valor: number;
  valorRecebido?: number;
  bandeira?: string;
  nsu?: string;
  autorizacao?: string;
};

export default function Pdv() {
  const { user, filialAtiva, logout } = useAuth();
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [ultimoCupom, setUltimoCupom] = useState<CupomImpressao | null>(null);
  // Impressão automática do cupom após a venda — opt-in por terminal (padrão OFF).
  const [cupomAuto, setCupomAutoState] = useState<boolean>(() => getCupomAuto());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // Multiplicador de quantidade: o próximo item bipado entra com esta qtd.
  // Ex.: digita "5*" no campo, ou clica no chip ×5, e bipa o produto → 5 un.
  const [mult, setMult] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  // Autocomplete por nome: sugestões de produtos enquanto o operador digita.
  const [sugestoes, setSugestoes] = useState<ProdutoBusca[]>([]);
  const [sugIdx, setSugIdx] = useState(-1);
  const buscaSeq = useRef(0); // descarta respostas fora de ordem (debounce)

  // Sessão / turno de caixa
  const [sessao, setSessao] = useState<SessaoRel | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [zReport, setZReport] = useState<SessaoRel | null>(null);
  const [modalCaixa, setModalCaixa] = useState<'SANGRIA' | 'SUPRIMENTO' | 'FECHAR' | null>(null);
  const [modalVendas, setModalVendas] = useState(false);

  const carregarSessao = useCallback(async () => {
    try {
      const { data } = await pdvApi.sessaoAtual(filialAtiva?.id);
      if (data && data.id) {
        const { data: rel } = await pdvApi.relatorio(data.id);
        setSessao(rel);
      } else {
        setSessao(null);
      }
    } catch {
      setSessao(null);
    } finally {
      setCarregandoSessao(false);
    }
  }, [filialAtiva?.id]);

  useEffect(() => {
    carregarSessao();
  }, [carregarSessao]);

  const total = useMemo(
    () => itens.reduce((s, i) => s + i.precoUnit * i.quantidade, 0),
    [itens],
  );
  // Contador de itens: produto por peso conta como 1 linha (6 kg ≠ 6 itens);
  // produto por unidade soma a quantidade (3 refris = 3 itens).
  const totalItens = useMemo(
    () => itens.reduce((s, i) => s + (i.unidade === 'KG' ? 1 : i.quantidade), 0),
    [itens],
  );

  // Desconto sobre o total da venda (valor fixo ou percentual).
  const [desconto, setDesconto] = useState<{ tipo: 'VALOR' | 'PERCENT'; valor: number }>({
    tipo: 'VALOR',
    valor: 0,
  });
  const [modalDesconto, setModalDesconto] = useState(false);
  // Produto vendido por peso: ao ler o código, abrimos o modal p/ digitar o peso (kg).
  const [pesoModal, setPesoModal] = useState<{
    produtoId: string; codigoBarras: string; descricao: string; precoUnit: number; unidade: string;
    qtdMult?: number; // multiplicador armado no momento do bipe (aplicado ao peso)
  } | null>(null);
  const descontoValor = useMemo(() => {
    const bruto = desconto.tipo === 'PERCENT' ? total * (desconto.valor / 100) : desconto.valor;
    return round2(Math.min(Math.max(0, bruto), total));
  }, [desconto, total]);
  const totalFinal = round2(total - descontoValor);

  // Mantém o foco no campo de leitura (o leitor "digita" o EAN + Enter)
  const focar = () => inputRef.current?.focus();
  useEffect(() => {
    if (!pagando) focar();
  }, [itens, pagando]);

  async function adicionarPorCodigo(cod: string) {
    let c = cod.trim();
    if (!c || buscando) return;

    // Multiplicador digitado: "5*7891234"/"5x7891234" ou só "5*" (define e espera o bipe).
    let qtd = mult;
    const m = c.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.*)$/);
    if (m) {
      const n = parseNum(m[1]);
      if (n > 0) qtd = n;
      c = m[2].trim();
      if (!c) {
        // Só definiu a quantidade (ex.: "5*") — guarda e aguarda o próximo item.
        setMult(qtd > 0 ? qtd : 1);
        setCodigo('');
        return;
      }
    }

    setBuscando(true);
    setAviso(null);
    try {
      const { data: prod } = await pdvApi.buscarProduto(c, filialAtiva?.id);
      inserirNoCarrinho(prod, qtd);
    } catch (e: any) {
      beepErro();
      const msg = e?.response?.data?.message || `Código ${c} não encontrado`;
      setAviso(Array.isArray(msg) ? msg[0] : msg);
      setCodigo('');
    } finally {
      setBuscando(false);
    }
  }

  /**
   * Insere no carrinho um produto já resolvido — tanto do bipe exato quanto de
   * uma sugestão escolhida por nome. Trata produto por peso (abre o modal de
   * pesagem) e o multiplicador de quantidade.
   */
  function inserirNoCarrinho(prod: ProdutoBusca, qtd: number) {
    beepOk();
    setUltimoCupom(null);
    setSugestoes([]);
    setSugIdx(-1);
    // Produto por peso: não dá pra assumir 1 kg — pede o peso ao operador.
    if (prod.vendidoPorPeso) {
      setPesoModal({
        produtoId: prod.id,
        codigoBarras: prod.codigoBarras || prod.codigo,
        descricao: prod.descricao,
        precoUnit: Number(prod.precoVenda),
        unidade: prod.unidade || 'KG',
        qtdMult: qtd > 0 ? qtd : 1, // preserva o ×N; só consome ao confirmar o peso
      });
      setCodigo('');
      return;
    }
    const add = qtd > 0 ? qtd : 1;
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produtoId === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantidade: copy[idx].quantidade + add };
        return copy;
      }
      return [
        ...prev,
        {
          produtoId: prod.id,
          codigoBarras: prod.codigoBarras || prod.codigo,
          descricao: prod.descricao,
          precoUnit: Number(prod.precoVenda),
          unidade: prod.unidade || 'UN',
          quantidade: add,
        },
      ];
    });
    setMult(1); // consumiu o multiplicador
    setCodigo('');
  }

  // Escolhe uma sugestão da lista (clique ou Enter/seta) e a lança no carrinho.
  function selecionarSugestao(prod: ProdutoBusca) {
    inserirNoCarrinho(prod, mult > 0 ? mult : 1);
    focar();
  }

  // Busca por nome/código enquanto digita (debounce). Não sugere para código
  // de barras puro (só dígitos) nem quando há multiplicador ("5*"), preservando
  // o fluxo do leitor. Descarta respostas antigas via `buscaSeq`.
  useEffect(() => {
    const termo = codigo.trim();
    const soDigitos = /^\d+$/.test(termo);
    if (termo.length < 2 || soDigitos || /[*xX]/.test(termo)) {
      setSugestoes([]);
      setSugIdx(-1);
      return;
    }
    const seq = ++buscaSeq.current;
    const t = setTimeout(async () => {
      try {
        const { data } = await pdvApi.buscarProdutos(termo, filialAtiva?.id);
        if (seq !== buscaSeq.current) return;
        setSugestoes(data);
        setSugIdx(data.length ? 0 : -1);
      } catch {
        if (seq === buscaSeq.current) {
          setSugestoes([]);
          setSugIdx(-1);
        }
      }
    }, 250);
    return () => clearTimeout(t);
  }, [codigo, filialAtiva?.id]);

  /**
   * Chip ×N: se houver uma linha selecionada, define a quantidade dela para N
   * (fácil de corrigir "vendi 6 desse"); senão, arma o multiplicador para o
   * próximo item bipado. Um clique, sem digitar.
   */
  function aplicarMultiplicador(n: number) {
    if (selecionadoId) {
      const sel = itens.find((i) => i.produtoId === selecionadoId);
      // Produto por peso: ×N não faz sentido (a quantidade é o peso da balança).
      // Ignora para não substituir, ex., 0,850 kg por "6".
      if (sel && sel.unidade === 'KG') {
        focar();
        return;
      }
      setItens((prev) =>
        prev.map((i) => (i.produtoId === selecionadoId ? { ...i, quantidade: n } : i)),
      );
    } else {
      setMult(n);
    }
    focar();
  }

  // Confirma o peso digitado (kg) e lança o item por peso na comanda.
  function adicionarPeso(kg: number) {
    const p = pesoModal;
    setPesoModal(null);
    if (!p || !(kg > 0)) return;
    const mult = p.qtdMult && p.qtdMult > 0 ? p.qtdMult : 1;
    const q = round3(kg * mult); // ex.: ×3 e 0,500 kg → 1,500 kg
    setMult(1); // consome o multiplicador só agora (se cancelasse, seguiria armado)
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produtoId === p.produtoId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantidade: round3(copy[idx].quantidade + q) };
        return copy;
      }
      return [
        ...prev,
        {
          produtoId: p.produtoId,
          codigoBarras: p.codigoBarras,
          descricao: p.descricao,
          precoUnit: p.precoUnit,
          unidade: p.unidade,
          quantidade: q,
        },
      ];
    });
  }

  function alterarQtd(produtoId: string, delta: number) {
    setItens((prev) =>
      prev
        .map((i) =>
          i.produtoId === produtoId
            ? { ...i, quantidade: Math.max(0, round3(i.quantidade + delta)) }
            : i,
        )
        .filter((i) => i.quantidade > 0),
    );
  }

  function remover(produtoId: string) {
    setItens((prev) => prev.filter((i) => i.produtoId !== produtoId));
  }

  function limpar() {
    setItens([]);
    setDesconto({ tipo: 'VALOR', valor: 0 });
    setMult(1);
    setSelecionadoId(null); // evita seleção "fantasma" de item que não existe mais
    setAviso(null);
    setSugestoes([]);
    setSugIdx(-1);
    focar();
  }

  async function confirmarPagamento(pagamentos: PagamentoEnvio[]) {
    if (!filialAtiva?.id) {
      setAviso('Nenhuma filial ativa. Refaça o login.');
      return { ok: false };
    }
    try {
      const { data } = await pdvApi.registrarVenda({
        filialId: filialAtiva.id,
        pagamentos,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnit: i.precoUnit,
          descricao: i.descricao,
          unidade: i.unidade,
        })),
        ...(descontoValor > 0 && {
          desconto: descontoValor,
          descontoTipo: desconto.tipo,
          descontoPercent: desconto.tipo === 'PERCENT' ? desconto.valor : undefined,
        }),
      });
      const cupom: CupomImpressao = {
        loja: filialAtiva?.nome || 'Loja',
        operador: user?.nome || 'Operador',
        numero: data.numero,
        formaPagamento: data.formaPagamento,
        dataEmissao: data.dataEmissao,
        itens: (data.itens || []).map((i: any) => ({
          descricao: i.descricao,
          quantidade: Number(i.quantidade),
          unidade: i.unidade || 'UN',
          precoUnit: Number(i.precoUnit),
          valorTotal: Number(i.valorTotal),
        })),
        valorTotal: Number(data.valorTotal),
        desconto: Number(data.desconto || 0),
        pagamentos: (data.pagamentos || []).map((p: any) => ({
          forma: p.forma,
          valor: Number(p.valor),
          troco: Number(p.troco || 0),
        })),
        troco: Number(data.troco || 0),
      };
      setUltimoCupom(cupom);
      // Só imprime sozinho se o terminal ativou o automático; senão o operador
      // usa o botão "Reimprimir cupom" quando quiser (evita o diálogo do Chrome
      // a cada venda em quem não tem impressora térmica configurada).
      if (cupomAuto) imprimirCupom(cupom);
      // Gaveta abre automaticamente quando há dinheiro na venda (não em cartão/PIX puro).
      if (pagamentos.some((p) => (p.forma || '').toUpperCase().startsWith('DINHEIRO'))) {
        void abrirGavetaAuto();
      }
      setPagando(false);
      limpar();
      carregarSessao(); // atualiza os totais do turno
      return { ok: true };
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha ao registrar a venda.';
      return { ok: false, erro: Array.isArray(msg) ? msg[0] : msg };
    }
  }

  // Atalhos globais de operação. Quando um modal está aberto (pagando/modalCaixa),
  // ele trata suas próprias teclas — aqui só agem os atalhos da tela principal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modalAberto = pagando || modalCaixa !== null || modalDesconto || modalVendas || pesoModal !== null;

      // ESC funciona sempre para fechar modais.
      if (e.key === 'Escape') {
        if (pagando) setPagando(false);
        else if (pesoModal) setPesoModal(null);
        else if (modalDesconto) setModalDesconto(false);
        else if (modalVendas) setModalVendas(false);
        else if (modalCaixa) setModalCaixa(null);
        return;
      }
      if (modalAberto) return; // demais atalhos só na tela principal

      switch (e.key) {
        case 'F2':
          if (itens.length > 0) { e.preventDefault(); setPagando(true); }
          break;
        case 'F4':
          if (itens.length > 0) { e.preventDefault(); setModalDesconto(true); }
          break;
        case 'F10':
          e.preventDefault(); setModalVendas(true);
          break;
        case 'F7':
          e.preventDefault(); setModalCaixa('SANGRIA');
          break;
        case 'F8':
          e.preventDefault(); setModalCaixa('SUPRIMENTO');
          break;
        case 'F9':
          e.preventDefault(); setModalCaixa('FECHAR');
          break;
        case 'Delete':
          if (selecionadoId) { e.preventDefault(); remover(selecionadoId); setSelecionadoId(null); }
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          if (itens.length === 0) break;
          e.preventDefault();
          const idx = itens.findIndex((i) => i.produtoId === selecionadoId);
          const next =
            e.key === 'ArrowDown'
              ? Math.min(itens.length - 1, idx < 0 ? 0 : idx + 1)
              : Math.max(0, idx < 0 ? 0 : idx - 1);
          setSelecionadoId(itens[next].produtoId);
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [itens, pagando, modalCaixa, modalDesconto, modalVendas, pesoModal, selecionadoId]);

  async function handleSangria(valor: number, descricao: string) {
    try {
      const { data } = await pdvApi.sangria({ valor, descricao });
      setSessao(data);
      setModalCaixa(null);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha na sangria.';
      return { ok: false, erro: Array.isArray(msg) ? msg[0] : msg };
    }
  }

  async function handleSuprimento(valor: number, descricao: string) {
    try {
      const { data } = await pdvApi.suprimento({ valor, descricao });
      setSessao(data);
      setModalCaixa(null);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha no suprimento.';
      return { ok: false, erro: Array.isArray(msg) ? msg[0] : msg };
    }
  }

  async function handleAbrirGaveta() {
    const r = await abrirGavetaManual();
    setAviso(r.ok ? 'Gaveta aberta.' : r.mensagem || 'Não foi possível abrir a gaveta.');
  }

  async function handleFechar(informado: number, obs: string) {
    if (itens.length > 0) {
      return { ok: false, erro: 'Finalize ou cancele a venda em andamento antes de fechar.' };
    }
    try {
      const { data } = await pdvApi.fecharSessao({ saldoFinalInformado: informado, observacoes: obs });
      setModalCaixa(null);
      setSessao(null);
      setUltimoCupom(null);
      setZReport(data);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha ao fechar o caixa.';
      return { ok: false, erro: Array.isArray(msg) ? msg[0] : msg };
    }
  }

  // ── Portões da sessão de caixa ──
  if (carregandoSessao) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0E0F16]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5B841]" />
      </div>
    );
  }
  if (zReport) {
    return <RelatorioZ z={zReport} onNovo={() => setZReport(null)} />;
  }
  if (!sessao) {
    return (
      <div className="h-screen">
        <AbrirCaixa filialId={filialAtiva?.id} onAberta={carregarSessao} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0E0F16] text-gray-100">
      {/* Topo */}
      <header className="flex items-center justify-between border-b border-[#222633] bg-[#171A26] px-6 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-[#F5B841]" />
          <span className="text-lg font-semibold">Frente de Caixa</span>
          <span className="ml-2 rounded bg-[#12B877]/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            {filialAtiva?.nome || 'Sem filial'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{user?.nome || 'Operador'}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1 rounded px-2 py-1 text-gray-400 hover:bg-[#222633] hover:text-gray-200"
            title="Sair"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lista de itens */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Campo de leitura */}
          <div className="border-b border-[#222633] bg-[#171A26]/60 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adicionarPorCodigo(codigo);
              }}
            >
              <div className="relative">
                <div className="flex items-center gap-3 rounded-lg border border-[#2D3140] bg-[#0E0F16] px-4 py-3 focus-within:border-[#F5B841]">
                  {buscando ? (
                    <Loader2 className="h-6 w-6 shrink-0 animate-spin text-[#F5B841]" />
                  ) : (
                    <ScanLine className="h-6 w-6 shrink-0 text-[#F5B841]" />
                  )}
                  <input
                    ref={inputRef}
                    autoFocus
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    onBlur={() => setTimeout(() => { setSugestoes([]); setSugIdx(-1); }, 120)}
                    onKeyDown={(e) => {
                      if (sugestoes.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault(); e.stopPropagation();
                        setSugIdx((i) => Math.min(sugestoes.length - 1, i + 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault(); e.stopPropagation();
                        setSugIdx((i) => Math.max(0, i - 1));
                      } else if (e.key === 'Escape') {
                        e.preventDefault(); e.stopPropagation();
                        setSugestoes([]); setSugIdx(-1);
                      } else if (e.key === 'Enter' && sugIdx >= 0 && sugIdx < sugestoes.length) {
                        // Enter com uma sugestão destacada lança o produto (não submete o form).
                        e.preventDefault();
                        selecionarSugestao(sugestoes[sugIdx]);
                      }
                    }}
                    placeholder="Bipe o código de barras ou digite o nome do produto"
                    className="w-full bg-transparent text-lg outline-none placeholder:text-gray-600"
                    autoComplete="off"
                  />
                </div>

                {/* Sugestões por nome/código */}
                {sugestoes.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-[#2D3140] bg-[#171A26] shadow-2xl">
                    {sugestoes.map((p, idx) => (
                      <li
                        key={p.id}
                        onMouseDown={(e) => { e.preventDefault(); selecionarSugestao(p); }}
                        onMouseEnter={() => setSugIdx(idx)}
                        className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${
                          idx === sugIdx ? 'bg-[#E8A317]/15' : 'hover:bg-[#222633]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-100">{p.descricao}</div>
                          <div className="truncate text-xs text-gray-500">
                            {p.codigoBarras || p.codigo}
                            <span className={p.estoqueDisponivel > 0 ? 'text-gray-500' : 'text-rose-400'}>
                              {' · '}
                              {p.vendidoPorPeso
                                ? `${p.estoqueDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
                                : `${p.estoqueDisponivel} un`}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 tabular-nums text-sm font-semibold text-emerald-400">
                          {brl(p.precoVenda)}
                          {p.vendidoPorPeso && <span className="text-xs text-gray-500">/kg</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
            {/* Multiplicador de quantidade — clique rápido (ou digite "5*" no campo). */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {selecionadoId ? 'Definir qtd do item' : 'Multiplicar'} ×
              </span>
              {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => aplicarMultiplicador(n)}
                  className={`min-w-[2.75rem] rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums transition ${
                    mult === n && !selecionadoId
                      ? 'border-[#E8A317] bg-[#E8A317]/20 text-amber-200'
                      : 'border-[#2D3140] bg-[#222633] text-gray-300 hover:border-gray-600 hover:bg-[#2D3140]'
                  }`}
                  title={selecionadoId ? `Definir ${n} unidades no item selecionado` : `Próximo item entra com ${n} unidades`}
                >
                  ×{n}
                </button>
              ))}
              {mult > 1 && !selecionadoId && (
                <button
                  onClick={() => { setMult(1); focar(); }}
                  className="ml-1 flex items-center gap-1 rounded-lg bg-[#E8A317]/15 px-3 py-1.5 text-sm font-semibold text-amber-200 ring-1 ring-inset ring-[#E8A317]/40"
                  title="Próximo item terá esta quantidade. Clique para limpar."
                >
                  Próximo item × {mult} <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {aviso && (
              <div className="mt-2 text-sm font-medium text-rose-400">{aviso}</div>
            )}
          </div>

          {/* Itens */}
          <div className="min-h-0 flex-1 overflow-auto">
            {itens.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-600">
                {ultimoCupom ? (
                  <div className="flex flex-col items-center text-center">
                    <Check className="mb-3 h-12 w-12 text-[#12B877]" />
                    <p className="text-lg font-semibold text-emerald-400">
                      Venda #{ultimoCupom.numero} registrada
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {brl(ultimoCupom.valorTotal)} · {ultimoCupom.formaPagamento}
                      {ultimoCupom.troco > 0 && ` · Troco ${brl(ultimoCupom.troco)}`}
                    </p>
                    <button
                      onClick={() => imprimirCupom(ultimoCupom)}
                      className="mt-4 flex items-center gap-2 rounded-lg bg-[#222633] px-4 py-2 text-sm text-gray-200 hover:bg-[#2D3140]"
                    >
                      <Printer className="h-4 w-4" /> Reimprimir cupom
                    </button>
                    <label
                      className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-400 select-none"
                      title="Ligue apenas se este caixa tem impressora térmica. Sem térmica, isto abre o diálogo de impressão do Chrome a cada venda."
                    >
                      <input
                        type="checkbox"
                        checked={cupomAuto}
                        onChange={(e) => {
                          setCupomAuto(e.target.checked);
                          setCupomAutoState(e.target.checked);
                        }}
                        className="h-4 w-4 accent-[#12B877]"
                      />
                      Imprimir cupom automaticamente
                    </label>
                    <p className="mt-3 text-sm text-gray-600">Bipe uma mercadoria para a próxima venda.</p>
                  </div>
                ) : (
                  <>
                    <Barcode className="mb-3 h-12 w-12" />
                    <p>Nenhum item. Bipe uma mercadoria para começar.</p>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#171A26] text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 text-right">Preço</th>
                    <th className="px-4 py-2 text-center">Qtd</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr
                      key={i.produtoId}
                      onClick={() => setSelecionadoId(i.produtoId)}
                      className={`cursor-pointer border-b border-[#222633]/60 ${
                        selecionadoId === i.produtoId ? 'bg-[#E8A317]/10 ring-1 ring-inset ring-[#E8A317]/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.descricao}</div>
                        <div className="text-xs text-gray-500">{i.codigoBarras}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {brl(i.precoUnit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => alterarQtd(i.produtoId, i.unidade === 'KG' ? -0.1 : -1)}
                            className="rounded bg-[#222633] p-1 hover:bg-[#2D3140]"
                            title={i.unidade === 'KG' ? 'Diminuir 0,1 kg' : 'Diminuir 1'}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-16 text-center tabular-nums">
                            {i.unidade === 'KG'
                              ? `${i.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
                              : i.quantidade}
                          </span>
                          <button
                            onClick={() => alterarQtd(i.produtoId, i.unidade === 'KG' ? 0.1 : 1)}
                            className="rounded bg-[#222633] p-1 hover:bg-[#2D3140]"
                            title={i.unidade === 'KG' ? 'Aumentar 0,1 kg' : 'Aumentar 1'}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {brl(i.precoUnit * i.quantidade)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => remover(i.produtoId)}
                          className="rounded p-1 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* Painel lateral — total e ações */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-[#222633] bg-[#171A26]">
          <div className="flex-1 p-6">
            <div className="text-sm text-gray-400">Itens: {totalItens}</div>
            {descontoValor > 0 && (
              <>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="tabular-nums text-gray-400 line-through">{brl(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#F5B841]">
                    Desconto{desconto.tipo === 'PERCENT' ? ` (${desconto.valor}%)` : ''}
                  </span>
                  <span className="tabular-nums text-[#F5B841]">- {brl(descontoValor)}</span>
                </div>
              </>
            )}
            <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
              Total a pagar
            </div>
            <div className="mt-1 text-5xl font-bold tabular-nums text-[#F5B841]">
              {brl(totalFinal)}
            </div>
          </div>
          <div className="space-y-2 p-4">
            <button
              onClick={() => setPagando(true)}
              disabled={itens.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E9560] py-4 text-lg font-semibold hover:bg-[#12B877] disabled:cursor-not-allowed disabled:bg-[#222633] disabled:text-gray-600"
            >
              <Check className="h-5 w-5" />
              Finalizar (F2)
            </button>
            <button
              onClick={() => setModalDesconto(true)}
              disabled={itens.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#222633] py-2 text-sm text-gray-300 hover:bg-[#2D3140] disabled:opacity-40"
            >
              <Percent className="h-4 w-4 text-[#F5B841]" />
              {descontoValor > 0 ? 'Alterar desconto' : 'Desconto'} (F4)
            </button>
            <button
              onClick={limpar}
              disabled={itens.length === 0}
              className="w-full rounded-lg bg-[#222633] py-2 text-sm text-gray-300 hover:bg-[#2D3140] disabled:opacity-40"
            >
              Cancelar venda
            </button>

            {/* Barra do caixa (turno) */}
            <div className="mt-2 border-t border-[#222633] pt-3">
              <div className="mb-2 flex justify-between text-xs text-gray-500">
                <span>Turno · {sessao.qtdVendas} venda(s)</span>
                <span>Gaveta: {brl(sessao.dinheiroEsperadoGaveta)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setModalCaixa('SANGRIA')}
                  className="flex flex-col items-center gap-1 rounded-lg bg-[#222633] py-2 text-xs text-gray-300 hover:bg-[#2D3140]"
                >
                  <ArrowDownCircle className="h-4 w-4 text-rose-400" /> Sangria
                  <span className="text-[10px] text-gray-500">F7</span>
                </button>
                <button
                  onClick={() => setModalCaixa('SUPRIMENTO')}
                  className="flex flex-col items-center gap-1 rounded-lg bg-[#222633] py-2 text-xs text-gray-300 hover:bg-[#2D3140]"
                >
                  <ArrowUpCircle className="h-4 w-4 text-emerald-400" /> Suprim.
                  <span className="text-[10px] text-gray-500">F8</span>
                </button>
                <button
                  onClick={() => setModalCaixa('FECHAR')}
                  className="flex flex-col items-center gap-1 rounded-lg bg-[#222633] py-2 text-xs text-gray-300 hover:bg-[#2D3140]"
                >
                  <Lock className="h-4 w-4 text-[#F5B841]" /> Fechar
                  <span className="text-[10px] text-gray-500">F9</span>
                </button>
              </div>
              <button
                onClick={() => setModalVendas(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#222633] py-2 text-xs text-gray-300 hover:bg-[#2D3140]"
              >
                <Printer className="h-4 w-4 text-[#F5B841]" /> Vendas / Reimprimir / Estorno
                <span className="text-[10px] text-gray-500">F10</span>
              </button>
              <button
                onClick={handleAbrirGaveta}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#222633] py-2 text-xs text-gray-300 hover:bg-[#2D3140]"
              >
                <Coins className="h-4 w-4 text-emerald-400" /> Abrir gaveta
              </button>
            </div>
          </div>
        </aside>
      </div>

      {pagando && (
        <ModalPagamento
          total={totalFinal}
          onFechar={() => setPagando(false)}
          onConfirmar={confirmarPagamento}
        />
      )}

      {modalDesconto && (
        <ModalDesconto
          total={total}
          atual={desconto}
          onFechar={() => setModalDesconto(false)}
          onConfirmar={(d) => { setDesconto(d); setModalDesconto(false); }}
        />
      )}

      {pesoModal && (
        <ModalPeso
          descricao={pesoModal.descricao}
          precoUnit={pesoModal.precoUnit}
          unidade={pesoModal.unidade}
          mult={pesoModal.qtdMult}
          onFechar={() => setPesoModal(null)}
          onConfirmar={adicionarPeso}
        />
      )}

      {modalVendas && (
        <ModalVendas
          filialId={filialAtiva?.id}
          onFechar={() => setModalVendas(false)}
          onEstornou={carregarSessao}
        />
      )}

      {modalCaixa === 'SANGRIA' && (
        <ModalValor
          titulo="Sangria (retirada)"
          cor="bg-rose-600 hover:bg-rose-500"
          icon={<ArrowDownCircle className="h-5 w-5 text-rose-300" />}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleSangria}
        />
      )}
      {modalCaixa === 'SUPRIMENTO' && (
        <ModalValor
          titulo="Suprimento (reforço)"
          cor="bg-[#0E9560] hover:bg-[#12B877]"
          icon={<ArrowUpCircle className="h-5 w-5 text-emerald-300" />}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleSuprimento}
        />
      )}
      {modalCaixa === 'FECHAR' && (
        <ModalFechar
          esperado={sessao.dinheiroEsperadoGaveta}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleFechar}
        />
      )}
    </div>
  );
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000; // preserva precisão de peso (kg)
const parseNum = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;

type Categoria = 'DINHEIRO' | 'CARTAO' | 'PIX';

function ModalPagamento({
  total,
  onFechar,
  onConfirmar,
}: {
  total: number;
  onFechar: () => void;
  onConfirmar: (
    pagamentos: PagamentoEnvio[],
  ) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const tef = getTefProvider();
  const temTef = tef.integrado;

  const [pagamentos, setPagamentos] = useState<PagamentoEnvio[]>([]);
  const [forma, setForma] = useState<Categoria>('DINHEIRO');
  const [canal, setCanal] = useState<'TEF' | 'POS'>(temTef ? 'TEF' : 'POS');
  const [tipoCartao, setTipoCartao] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
  const [valorStr, setValorStr] = useState('');
  const [recebidoStr, setRecebidoStr] = useState('');
  const [processando, setProcessando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  // Trava síncrona contra dupla finalização (Enter repetido + auto-finalizar).
  const finalizandoRef = useRef(false);

  const pago = round2(pagamentos.reduce((s, p) => s + p.valor, 0));
  const restante = round2(total - pago);
  const trocoAcum = round2(
    pagamentos.reduce((s, p) => s + Math.max(0, (p.valorRecebido ?? p.valor) - p.valor), 0),
  );

  // Valor desta parcela: por padrão o que falta; limitado ao restante.
  const valorDigitado = parseNum(valorStr);
  const valorAplicado = round2(Math.min(valorDigitado > 0 ? valorDigitado : restante, restante));
  const recebidoNum = parseNum(recebidoStr) || valorAplicado;
  const trocoAtual = forma === 'DINHEIRO' ? round2(Math.max(0, recebidoNum - valorAplicado)) : 0;
  const dinheiroInsuficiente = forma === 'DINHEIRO' && recebidoNum + 0.001 < valorAplicado;
  const completaAgora = valorAplicado >= restante - 0.005;

  function formaDetalhada(): string {
    if (forma === 'DINHEIRO') return 'DINHEIRO';
    const suf = canal === 'TEF' ? 'TEF' : 'POS';
    return `${forma}_${suf}`;
  }

  async function finalizar(lista: PagamentoEnvio[]) {
    if (finalizandoRef.current) return; // já há um registro em curso
    finalizandoRef.current = true;
    setSalvando(true);
    setErro(null);
    const res = await onConfirmar(lista);
    if (!res.ok) {
      setErro(res.erro || 'Falha ao registrar a venda.');
      setSalvando(false);
      finalizandoRef.current = false; // libera para nova tentativa
    }
    // sucesso: o componente pai fecha o modal (ref não precisa ser liberado)
  }

  async function adicionar() {
    if (salvando || processando) return;
    if (restante <= 0.005) return;
    if (valorAplicado <= 0) { setErro('Informe um valor válido.'); return; }
    if (dinheiroInsuficiente) { setErro('Valor recebido menor que o valor a pagar.'); return; }
    setErro(null);

    const base: PagamentoEnvio = { forma: formaDetalhada(), valor: valorAplicado };
    if (forma === 'DINHEIRO') base.valorRecebido = recebidoNum;

    // Cartão/PIX via TEF integrado → dispara na máquina.
    if (forma !== 'DINHEIRO' && canal === 'TEF' && temTef) {
      const canalTef: CanalPagamento =
        forma === 'PIX' ? 'PIX' : tipoCartao === 'DEBITO' ? 'DEBITO' : 'CREDITO';
      setProcessando('Envie/insira o cartão na máquina...');
      const r = await tef.transacionar({ canal: canalTef, valor: valorAplicado });
      setProcessando(null);
      if (!r.aprovado) {
        setErro(r.mensagem || 'Transação não aprovada.');
        return;
      }
      base.bandeira = r.bandeira;
      base.nsu = r.nsu;
      base.autorizacao = r.autorizacao;
    }

    const nova = [...pagamentos, base];
    setPagamentos(nova);
    setValorStr('');
    setRecebidoStr('');

    const novoRestante = round2(total - nova.reduce((s, p) => s + p.valor, 0));
    if (novoRestante <= 0.005) {
      finalizar(nova);
    } else {
      setTimeout(() => valorRef.current?.focus(), 0);
    }
  }

  function removerPagamento(idx: number) {
    setPagamentos((prev) => prev.filter((_, i) => i !== idx));
  }

  // Atalhos do modal: F3/F4/F5 formas, F6 alterna TEF/POS, Enter adiciona.
  // Assina uma vez e sempre executa a lógica mais recente via ref — evita
  // re-inscrever o listener a cada render (bug) sem perder o estado atual.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
    if (processando || salvando) return;
    switch (e.key) {
      case 'F3': e.preventDefault(); setForma('DINHEIRO'); break;
      case 'F4': e.preventDefault(); setForma('CARTAO'); break;
      case 'F5': e.preventDefault(); setForma('PIX'); break;
      case 'F6':
        if (temTef && forma !== 'DINHEIRO') { e.preventDefault(); setCanal((c) => (c === 'TEF' ? 'POS' : 'TEF')); }
        break;
      case 'Enter': e.preventDefault(); adicionar(); break;
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const formas: { id: Categoria; label: string; tecla: string; icon: JSX.Element }[] = [
    { id: 'DINHEIRO', label: 'Dinheiro', tecla: 'F3', icon: <Banknote className="h-5 w-5" /> },
    { id: 'CARTAO', label: 'Cartão', tecla: 'F4', icon: <CreditCard className="h-5 w-5" /> },
    { id: 'PIX', label: 'PIX', tecla: 'F5', icon: <QrCode className="h-5 w-5" /> },
  ];

  const rotuloCanal = (c: string) =>
    c.endsWith('_TEF') ? 'TEF' : c.endsWith('_POS') ? 'POS' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#222633] bg-[#171A26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222633] px-6 py-4">
          <h2 className="text-lg font-semibold">Pagamento</h2>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
              <div className="text-3xl font-bold tabular-nums text-gray-200">{brl(total)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">Restante</div>
              <div className={`text-3xl font-bold tabular-nums ${restante > 0.005 ? 'text-[#F5B841]' : 'text-emerald-400'}`}>
                {brl(Math.max(0, restante))}
              </div>
            </div>
          </div>

          {/* Pagamentos já lançados (pagamento dividido) */}
          {pagamentos.length > 0 && (
            <div className="mt-4 space-y-1">
              {pagamentos.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-[#0E0F16]/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">
                      {p.forma.replace('_TEF', '').replace('_POS', '').replace('CARTAO', 'Cartão').replace('DINHEIRO', 'Dinheiro')}
                    </span>
                    {rotuloCanal(p.forma) && (
                      <span className="rounded bg-[#222633] px-1.5 py-0.5 text-[10px] text-gray-400">{rotuloCanal(p.forma)}</span>
                    )}
                    {p.nsu && <span className="text-[10px] text-gray-500">NSU {p.nsu}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-gray-300">{brl(p.valor)}</span>
                    <button onClick={() => removerPagamento(idx)} className="text-gray-500 hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Seletor de forma */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {formas.map((f) => (
              <button
                key={f.id}
                onClick={() => setForma(f.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border py-3 text-sm ${
                  forma === f.id
                    ? 'border-[#E8A317] bg-[#E8A317]/10 text-amber-300'
                    : 'border-[#2D3140] text-gray-400 hover:border-gray-600'
                }`}
              >
                {f.icon}
                {f.label}
                <span className="text-[10px] text-gray-500">{f.tecla}</span>
              </button>
            ))}
          </div>

          {/* Canal TEF x POS (cartão/PIX) */}
          {forma !== 'DINHEIRO' && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Máquina:</span>
              <button
                onClick={() => setCanal('TEF')}
                disabled={!temTef}
                className={`rounded-md px-3 py-1 ${canal === 'TEF' ? 'bg-[#E8A317] text-slate-900' : 'bg-[#222633] text-gray-400'} disabled:opacity-40`}
                title={temTef ? 'Máquina integrada (TEF) — F6' : 'Nenhum TEF configurado'}
              >
                Integrada (TEF)
              </button>
              <button
                onClick={() => setCanal('POS')}
                className={`rounded-md px-3 py-1 ${canal === 'POS' ? 'bg-[#E8A317] text-slate-900' : 'bg-[#222633] text-gray-400'}`}
                title="Maquininha avulsa — operar na mão (F6)"
              >
                Avulsa (POS)
              </button>
              {forma === 'CARTAO' && canal === 'TEF' && (
                <span className="ml-auto flex gap-1">
                  <button
                    onClick={() => setTipoCartao('CREDITO')}
                    className={`rounded px-2 py-1 text-xs ${tipoCartao === 'CREDITO' ? 'bg-[#2D3140] text-gray-100' : 'bg-[#222633] text-gray-500'}`}
                  >Crédito</button>
                  <button
                    onClick={() => setTipoCartao('DEBITO')}
                    className={`rounded px-2 py-1 text-xs ${tipoCartao === 'DEBITO' ? 'bg-[#2D3140] text-gray-100' : 'bg-[#222633] text-gray-500'}`}
                  >Débito</button>
                </span>
              )}
            </div>
          )}

          {/* Valor da parcela + (dinheiro) valor recebido */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Valor {pagamentos.length > 0 || valorStr ? 'a lançar' : '(total)'}</label>
              <input
                ref={valorRef}
                autoFocus={forma !== 'DINHEIRO'}
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                placeholder={brl(restante).replace('R$', '').trim()}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-[#2D3140] bg-[#0E0F16] px-3 py-2.5 text-lg outline-none focus:border-[#F5B841]"
              />
            </div>
            {forma === 'DINHEIRO' && (
              <div>
                <label className="text-xs text-gray-400">Valor recebido</label>
                <input
                  autoFocus
                  value={recebidoStr}
                  onChange={(e) => setRecebidoStr(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-[#2D3140] bg-[#0E0F16] px-3 py-2.5 text-lg outline-none focus:border-[#F5B841]"
                />
              </div>
            )}
          </div>

          {(trocoAtual > 0 || trocoAcum > 0 || dinheiroInsuficiente) && (
            <div className="mt-2 flex justify-between text-sm">
              {dinheiroInsuficiente ? (
                <span className="text-rose-400">Recebido menor que o valor</span>
              ) : (
                <span className="text-gray-500">&nbsp;</span>
              )}
              <span className="text-emerald-400">Troco: {brl(round2(trocoAtual + trocoAcum))}</span>
            </div>
          )}

          {processando && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#E8A317]/10 px-3 py-2 text-sm text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" /> {processando}
            </div>
          )}
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</div>
          )}

          <button
            onClick={adicionar}
            disabled={salvando || !!processando || restante <= 0.005 || valorAplicado <= 0 || dinheiroInsuficiente}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E9560] py-4 text-lg font-semibold hover:bg-[#12B877] disabled:cursor-not-allowed disabled:bg-[#222633] disabled:text-gray-600"
          >
            {salvando || processando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {salvando
              ? 'Registrando...'
              : processando
                ? 'Processando...'
                : completaAgora
                  ? 'Finalizar (Enter)'
                  : 'Adicionar pagamento (Enter)'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Limite de desconto (%) que o operador pode conceder direto no caixa. */
const DESCONTO_MAX_PCT = (() => {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const v = Number(env.VITE_DESCONTO_MAX_PCT);
  return Number.isFinite(v) && v > 0 ? v : 100;
})();

function ModalDesconto({
  total,
  atual,
  onFechar,
  onConfirmar,
}: {
  total: number;
  atual: { tipo: 'VALOR' | 'PERCENT'; valor: number };
  onFechar: () => void;
  onConfirmar: (d: { tipo: 'VALOR' | 'PERCENT'; valor: number }) => void;
}) {
  const [tipo, setTipo] = useState<'VALOR' | 'PERCENT'>(atual.valor > 0 ? atual.tipo : 'PERCENT');
  const [valorStr, setValorStr] = useState(
    atual.valor > 0 ? String(atual.valor).replace('.', ',') : '',
  );

  const val = parseNum(valorStr);
  const descontoValor = round2(
    Math.min(Math.max(0, tipo === 'PERCENT' ? total * (val / 100) : val), total),
  );
  const pct = total > 0 ? (descontoValor / total) * 100 : 0;
  const excede = pct > DESCONTO_MAX_PCT + 0.001;
  const totalFinal = round2(total - descontoValor);

  function confirmar() {
    if (excede) return;
    onConfirmar({ tipo, valor: val > 0 ? val : 0 });
  }

  // Listener estável: assina uma vez e chama sempre a lógica mais recente.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#222633] bg-[#171A26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222633] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Percent className="h-5 w-5 text-[#F5B841]" /> Desconto na venda
          </h2>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4 flex justify-between text-sm">
            <span className="text-gray-500">Total atual</span>
            <span className="tabular-nums text-gray-300">{brl(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipo('PERCENT')}
              className={`rounded-lg border py-2 text-sm ${
                tipo === 'PERCENT'
                  ? 'border-[#E8A317] bg-[#E8A317]/10 text-amber-300'
                  : 'border-[#2D3140] text-gray-400 hover:border-gray-600'
              }`}
            >
              Percentual (%)
            </button>
            <button
              onClick={() => setTipo('VALOR')}
              className={`rounded-lg border py-2 text-sm ${
                tipo === 'VALOR'
                  ? 'border-[#E8A317] bg-[#E8A317]/10 text-amber-300'
                  : 'border-[#2D3140] text-gray-400 hover:border-gray-600'
              }`}
            >
              Valor (R$)
            </button>
          </div>

          <input
            autoFocus
            value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            placeholder={tipo === 'PERCENT' ? '0%' : '0,00'}
            inputMode="decimal"
            className="mt-4 w-full rounded-lg border border-[#2D3140] bg-[#0E0F16] px-3 py-2.5 text-lg outline-none focus:border-[#E8A317]"
          />

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Desconto</span>
              <span className="tabular-nums text-[#F5B841]">- {brl(descontoValor)} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Novo total</span>
              <span className="tabular-nums font-semibold text-emerald-400">{brl(totalFinal)}</span>
            </div>
          </div>

          {excede && (
            <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              Desconto acima do limite do operador ({DESCONTO_MAX_PCT}%). Chame o gerente.
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => onConfirmar({ tipo: 'VALOR', valor: 0 })}
              className="flex-1 rounded-lg bg-[#222633] py-3 text-sm text-gray-300 hover:bg-[#2D3140]"
            >
              Remover
            </button>
            <button
              onClick={confirmar}
              disabled={excede}
              className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-[#CE8F14] py-3 font-semibold hover:bg-[#E8A317] disabled:cursor-not-allowed disabled:bg-[#222633] disabled:text-gray-600"
            >
              <Check className="h-5 w-5" /> Aplicar (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal de pesagem: digita-se o peso (kg) de um produto vendido por peso;
 *  o subtotal é preço/kg × peso. Enter confirma. */
function ModalPeso({
  descricao,
  precoUnit,
  unidade,
  mult,
  onFechar,
  onConfirmar,
}: {
  descricao: string;
  precoUnit: number;
  unidade: string;
  mult?: number;
  onFechar: () => void;
  onConfirmar: (kg: number) => void;
}) {
  const [pesoStr, setPesoStr] = useState('');
  const kg = parseNum(pesoStr);
  const multQtd = mult && mult > 0 ? mult : 1;
  const subtotal = round2(precoUnit * (kg > 0 ? kg : 0) * multQtd);

  function confirmar() {
    if (!(kg > 0)) return;
    onConfirmar(round3(kg));
  }

  // Listener de teclado: assina uma vez e sempre chama a lógica mais recente
  // (evita re-inscrição a cada render e closures desatualizadas).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#222633] bg-[#171A26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222633] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-5 w-5 text-[#F5B841]" /> Pesar produto
          </h2>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-1 text-sm font-medium text-gray-200">{descricao}</div>
          <div className="mb-4 text-sm text-gray-500">
            {brl(precoUnit)} / {unidade || 'KG'}
          </div>

          <label className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
            <span>Peso ({unidade || 'KG'})</span>
            {multQtd > 1 && (
              <span className="rounded bg-[#E8A317]/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
                × {multQtd}
              </span>
            )}
          </label>
          <input
            autoFocus
            value={pesoStr}
            onChange={(e) => setPesoStr(e.target.value)}
            placeholder="0,000"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-[#2D3140] bg-[#0E0F16] px-3 py-2.5 text-lg outline-none focus:border-[#F5B841]"
          />

          <div className="mt-4 flex justify-between text-sm">
            <span className="text-gray-500">
              Subtotal{multQtd > 1 ? ` (${kg > 0 ? kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : 0} kg × ${multQtd})` : ''}
            </span>
            <span className="tabular-nums font-semibold text-emerald-400">{brl(subtotal)}</span>
          </div>

          <button
            onClick={confirmar}
            disabled={!(kg > 0)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8A317] py-3 font-semibold text-slate-900 hover:bg-[#F5B841] disabled:cursor-not-allowed disabled:bg-[#222633] disabled:text-gray-600"
          >
            <Check className="h-5 w-5" /> Adicionar (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

type VendaRecente = {
  pedidoId: string;
  numero: number;
  status: string;
  valorTotal: number;
  formaPagamento: string | null;
  dataEmissao: string;
  operador: string | null;
  estornada: boolean;
};

function ModalVendas({
  filialId,
  onFechar,
  onEstornou,
}: {
  filialId?: string;
  onFechar: () => void;
  onEstornou: () => void;
}) {
  const [vendas, setVendas] = useState<VendaRecente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data } = await pdvApi.vendasRecentes(filialId);
      setVendas(data);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao carregar as vendas.');
    } finally {
      setCarregando(false);
    }
  }, [filialId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function reimprimir(v: VendaRecente) {
    setBusy(v.pedidoId);
    setErro(null);
    try {
      const { data } = await pdvApi.cupomVenda(v.pedidoId);
      imprimirCupom({
        loja: data.loja,
        operador: data.operador,
        numero: data.numero,
        dataEmissao: data.dataEmissao,
        itens: (data.itens || []).map((i: any) => ({
          descricao: i.descricao,
          quantidade: Number(i.quantidade),
          unidade: i.unidade || 'UN',
          precoUnit: Number(i.precoUnit),
          valorTotal: Number(i.valorTotal),
        })),
        valorTotal: Number(data.valorTotal),
        desconto: Number(data.desconto || 0),
        pagamentos: (data.pagamentos || []).map((p: any) => ({
          forma: p.forma,
          valor: Number(p.valor),
          troco: 0,
        })),
        troco: 0,
      });
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao reimprimir.');
    } finally {
      setBusy(null);
    }
  }

  async function estornar(v: VendaRecente) {
    if (
      !window.confirm(
        `Estornar a venda #${v.numero} (${brl(v.valorTotal)})?\nIsso devolve o estoque e reverte a entrada no caixa.`,
      )
    )
      return;
    setBusy(v.pedidoId);
    setErro(null);
    try {
      await pdvApi.estornarVenda(v.pedidoId);
      await carregar();
      onEstornou();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha ao estornar.';
      setErro(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[#222633] bg-[#171A26] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#222633] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-[#F5B841]" /> Vendas recentes
          </h2>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-300" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {erro && (
            <div className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{erro}</div>
          )}
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#F5B841]" />
            </div>
          ) : vendas.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Nenhuma venda registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">Nº</th>
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Forma</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.pedidoId} className="border-b border-[#222633]/60">
                    <td className="px-2 py-2 font-medium">#{v.numero}</td>
                    <td className="px-2 py-2 text-gray-400">
                      {new Date(v.dataEmissao).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2 text-gray-400">{v.formaPagamento || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {brl(v.valorTotal)}
                      {v.estornada && (
                        <span className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
                          ESTORNADA
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => reimprimir(v)}
                          disabled={busy === v.pedidoId}
                          className="flex items-center gap-1 rounded bg-[#222633] px-2 py-1 text-xs text-gray-200 hover:bg-[#2D3140] disabled:opacity-40"
                        >
                          <Printer className="h-3.5 w-3.5" /> Reimprimir
                        </button>
                        {!v.estornada && (
                          <button
                            onClick={() => estornar(v)}
                            disabled={busy === v.pedidoId}
                            className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            {busy === v.pedidoId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Estornar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
