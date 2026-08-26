import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode, Trash2, ShoppingCart, CreditCard,
  Banknote, QrCode, X, Check, ScanLine, LogOut, Loader2,
  ArrowDownCircle, ArrowUpCircle, Lock, Printer, Percent, Coins, Scale,
  ShieldCheck, FileText, AlertTriangle, User as UserIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../../../contexts/AuthContext';
import { pdvApi } from '../../../services/api';
import {
  AbrirCaixa, ModalValor, ModalFechar, RelatorioZ, SessaoRel,
} from '../components/CaixaSessao';
import { getTefProvider, type CanalPagamento } from '../tef/tef';
import { beepOk, beepErro } from '../som';
import { imprimirCupom, getCupomAuto, setCupomAuto, type CupomImpressao } from '../cupom';
import {
  imprimirCupomFiscal, imprimirComprovanteMovimento, imprimirComprovanteFechamento,
  type CupomFiscalImpressao, type DadosFiscais,
} from '../comprovante';
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

// Operações do caixa que podem exigir senha gerencial (config por loja).
type AcaoGerencial =
  | 'cancelar'
  | 'remover'
  | 'desconto'
  | 'sangria'
  | 'suprimento'
  | 'fechar'
  | 'estorno';

// Config pública do caixa (nunca traz o hash — só se há senha definida + toggles).
type ConfigCaixaRel = {
  senhaDefinida: boolean;
  senhaCancelarVenda: boolean;
  senhaRemoverItem: boolean;
  senhaDesconto: boolean;
  senhaSangria: boolean;
  senhaSuprimento: boolean;
  senhaFecharCaixa: boolean;
  senhaEstorno: boolean;
};

// Cada operação sensível aponta para o seu toggle na config da loja.
const CONFIG_POR_ACAO: Record<AcaoGerencial, keyof ConfigCaixaRel> = {
  cancelar: 'senhaCancelarVenda',
  remover: 'senhaRemoverItem',
  desconto: 'senhaDesconto',
  sangria: 'senhaSangria',
  suprimento: 'senhaSuprimento',
  fechar: 'senhaFecharCaixa',
  estorno: 'senhaEstorno',
};

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
  // Dados fiscais (NFC-e) da última venda — chave/QR/status para exibir e reimprimir.
  const [ultimaFiscal, setUltimaFiscal] = useState<DadosFiscais | null>(null);
  const [ultimoCupomFiscal, setUltimoCupomFiscal] = useState<CupomFiscalImpressao | null>(null);
  // Portão de autorização por senha gerencial para operações sensíveis.
  const [gate, setGate] = useState<{ label: string; onOk: () => void } | null>(null);
  // Config do caixa da loja: quais operações exigem a senha gerencial interna.
  const [configCaixa, setConfigCaixa] = useState<ConfigCaixaRel | null>(null);
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

  // Carrega a config do caixa da loja (quais operações pedem senha gerencial).
  useEffect(() => {
    if (!filialAtiva?.id) return;
    let ativo = true;
    (async () => {
      try {
        const { data } = await pdvApi.configCaixaGet(filialAtiva.id);
        if (ativo) setConfigCaixa(data);
      } catch {
        if (ativo) setConfigCaixa(null);
      }
    })();
    return () => { ativo = false; };
  }, [filialAtiva?.id]);

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
  // Portão por senha gerencial da loja. Se a operação não exige senha (config
  // desligada) ou ainda não há senha cadastrada, executa direto (fail-open —
  // não dá pra travar sem senha). Caso contrário, abre o modal e só executa
  // onOk após validar a senha gerencial.
  function pedirGerencial(acao: AcaoGerencial, label: string, onOk: () => void) {
    const exige = configCaixa ? !!configCaixa[CONFIG_POR_ACAO[acao]] : false;
    if (!exige || !configCaixa?.senhaDefinida) {
      onOk();
      return;
    }
    setGate({ label, onOk });
  }

  function inserirNoCarrinho(prod: ProdutoBusca, qtd: number) {
    beepOk();
    setUltimoCupom(null);
    setUltimaFiscal(null);
    setUltimoCupomFiscal(null);
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
  // Respeita a quantidade digitada como prefixo ("2xmorango") ou o multiplicador armado.
  function selecionarSugestao(prod: ProdutoBusca) {
    const mm = codigo.trim().match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*/);
    const qtd = mm ? (parseNum(mm[1]) || 1) : (mult > 0 ? mult : 1);
    inserirNoCarrinho(prod, qtd);
    focar();
  }

  // Busca por nome/código enquanto digita (debounce). Aceita multiplicador na
  // frente ("2xmorango" → busca "morango" e depois lança com qtd 2). Não sugere
  // para código de barras puro (só dígitos) nem para "2x" ainda sem nome,
  // preservando o fluxo do leitor. Descarta respostas antigas via `buscaSeq`.
  useEffect(() => {
    const termo = codigo.trim();
    // Remove um multiplicador inicial ("2x", "3*") para buscar pelo nome/código seguinte.
    const mm = termo.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.*)$/);
    const busca = mm ? mm[2].trim() : termo;
    const soDigitos = /^\d+$/.test(busca);
    if (busca.length < 2 || soDigitos) {
      setSugestoes([]);
      setSugIdx(-1);
      return;
    }
    const seq = ++buscaSeq.current;
    const t = setTimeout(async () => {
      try {
        const { data } = await pdvApi.buscarProdutos(busca, filialAtiva?.id);
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
   * Chip ×N: arma o multiplicador para o PRÓXIMO item bipado. Não altera a
   * quantidade de itens já lançados — depois de bipar não se muda a quantidade
   * (anti-fraude). Para corrigir, remove o item (com senha) e bipa de novo.
   */
  function aplicarMultiplicador(n: number) {
    setMult(n);
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

  async function confirmarPagamento(
    pagamentos: PagamentoEnvio[],
    opts?: { cpfNota?: string },
  ) {
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
        ...(opts?.cpfNota ? { cpfNota: opts.cpfNota } : {}),
        ...(descontoValor > 0 && {
          desconto: descontoValor,
          descontoTipo: desconto.tipo,
          descontoPercent: desconto.tipo === 'PERCENT' ? desconto.valor : undefined,
        }),
      });
      const itensCupom = (data.itens || []).map((i: any) => ({
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        unidade: i.unidade || 'UN',
        precoUnit: Number(i.precoUnit),
        valorTotal: Number(i.valorTotal),
      }));
      const pagCupom = (data.pagamentos || []).map((p: any) => ({
        forma: p.forma,
        valor: Number(p.valor),
        troco: Number(p.troco || 0),
      }));
      const cupom: CupomImpressao = {
        loja: filialAtiva?.nome || 'Loja',
        operador: user?.nome || 'Operador',
        numero: data.numero,
        formaPagamento: data.formaPagamento,
        dataEmissao: data.dataEmissao,
        itens: itensCupom,
        valorTotal: Number(data.valorTotal),
        desconto: Number(data.desconto || 0),
        pagamentos: pagCupom,
        troco: Number(data.troco || 0),
      };
      setUltimoCupom(cupom);

      // NFC-e: se a venda emitiu (ou tentou emitir) cupom fiscal, guardamos os
      // dados p/ exibir chave/QR na tela e (re)imprimir o DANFCE. Quando a nota
      // sai autorizada, o DANFCE substitui o cupom não-fiscal na impressão auto.
      const fiscal: DadosFiscais | null = data.fiscal || null;
      setUltimaFiscal(fiscal);
      const emitido = !!fiscal && (fiscal.status === 'EMITIDO' || !!fiscal.chaveAcesso);
      let cupomFiscal: CupomFiscalImpressao | null = null;
      if (emitido && fiscal) {
        cupomFiscal = {
          loja: filialAtiva?.nome || 'Loja',
          cnpjLoja: (filialAtiva as any)?.cnpj || null,
          operador: user?.nome || 'Operador',
          numeroVenda: data.numero,
          dataEmissao: data.dataEmissao,
          itens: itensCupom,
          valorTotal: Number(data.valorTotal),
          desconto: Number(data.desconto || 0),
          pagamentos: pagCupom.map((p) => ({ forma: p.forma, valor: p.valor })),
          troco: Number(data.troco || 0),
          fiscal,
        };
      }
      setUltimoCupomFiscal(cupomFiscal);

      // Só imprime sozinho se o terminal ativou o automático; senão o operador
      // usa o botão "Reimprimir cupom" quando quiser (evita o diálogo do Chrome
      // a cada venda em quem não tem impressora térmica configurada).
      if (cupomAuto) {
        if (cupomFiscal) void imprimirCupomFiscal(cupomFiscal);
        else imprimirCupom(cupom);
      }
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
          if (itens.length > 0) { e.preventDefault(); pedirGerencial('desconto', 'Aplicar desconto', () => setModalDesconto(true)); }
          break;
        case 'F10':
          e.preventDefault(); setModalVendas(true);
          break;
        case 'F7':
          e.preventDefault(); pedirGerencial('sangria', 'Sangria (retirada de caixa)', () => setModalCaixa('SANGRIA'));
          break;
        case 'F8':
          e.preventDefault(); pedirGerencial('suprimento', 'Suprimento (reforço de troco)', () => setModalCaixa('SUPRIMENTO'));
          break;
        case 'F9':
          e.preventDefault(); pedirGerencial('fechar', 'Fechar caixa', () => setModalCaixa('FECHAR'));
          break;
        case 'Delete':
          if (selecionadoId) {
            e.preventDefault();
            const alvo = selecionadoId;
            pedirGerencial('remover', 'Remover item da venda', () => { remover(alvo); setSelecionadoId(null); });
          }
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
  }, [itens, pagando, modalCaixa, modalDesconto, modalVendas, pesoModal, selecionadoId, configCaixa]);

  async function handleSangria(valor: number, descricao: string) {
    try {
      const { data } = await pdvApi.sangria({ valor, descricao });
      setSessao(data);
      setModalCaixa(null);
      // Comprovante de sangria (assim como a nota fiscal — sai impresso).
      imprimirComprovanteMovimento({
        tipo: 'SANGRIA',
        loja: filialAtiva?.nome || 'Loja',
        operador: user?.nome || 'Operador',
        valor,
        descricao,
        saldoGaveta: data?.dinheiroEsperadoGaveta,
      });
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
      imprimirComprovanteMovimento({
        tipo: 'SUPRIMENTO',
        loja: filialAtiva?.nome || 'Loja',
        operador: user?.nome || 'Operador',
        valor,
        descricao,
        saldoGaveta: data?.dinheiroEsperadoGaveta,
      });
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

  async function handleFechar({ dinheiro, cartao, pix, obs }: { dinheiro: number; cartao: number; pix: number; obs: string }) {
    if (itens.length > 0) {
      return { ok: false, erro: 'Finalize ou cancele a venda em andamento antes de fechar.' };
    }
    try {
      const { data } = await pdvApi.fecharSessao({
        saldoFinalInformado: dinheiro,
        cartaoInformado: cartao,
        pixInformado: pix,
        observacoes: obs,
      });
      setModalCaixa(null);
      setSessao(null);
      setUltimoCupom(null);
      setUltimaFiscal(null);
      setUltimoCupomFiscal(null);
      setZReport(data);
      // Comprovante de fechamento (relatório Z) — sai impresso ao fechar o caixa.
      imprimirComprovanteFechamento({
        loja: filialAtiva?.nome || 'Loja',
        operador: data.operador || user?.nome || 'Operador',
        abertaEm: data.abertaEm,
        fechadaEm: data.fechadaEm,
        saldoInicial: data.saldoInicial,
        qtdVendas: data.qtdVendas,
        totalVendas: data.totalVendas,
        totalDinheiro: data.totalDinheiro,
        totalCartao: data.totalCartao,
        totalPix: data.totalPix,
        totalSangria: data.totalSangria,
        totalSuprimento: data.totalSuprimento,
        dinheiroEsperadoGaveta: data.dinheiroEsperadoGaveta,
        saldoFinalInformado: data.saldoFinalInformado,
        diferenca: data.diferenca,
        cartaoInformado: data.cartaoInformado,
        pixInformado: data.pixInformado,
        diferencaCartao: data.diferencaCartao,
        diferencaPix: data.diferencaPix,
      });
      return { ok: true };
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Falha ao fechar o caixa.';
      return { ok: false, erro: Array.isArray(msg) ? msg[0] : msg };
    }
  }

  // ── Portões da sessão de caixa ──
  if (carregandoSessao) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#01B8FA]" />
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
    <div className="flex h-screen flex-col bg-[#F4F5F7] text-[#F7F8FA]">
      {/* Topo */}
      <header className="flex items-center justify-between border-b border-[#23262F] bg-[#101216] px-6 py-3 shadow-[0_1px_2px_rgba(22,23,29,0.04)]">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#01B8FA]/10 ring-1 ring-inset ring-[#01B8FA]/20">
            <ShoppingCart className="h-5 w-5 text-[#01B8FA]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">Frente de Caixa</span>
            <span className="mt-0.5 text-[11px] text-[#8A90A0]">Lumin PDV</span>
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-[#01B8FA]/10 px-2.5 py-1 text-xs font-medium text-[#2DD4A7] ring-1 ring-inset ring-[#01B8FA]/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4A7]" />
            {filialAtiva?.nome || 'Sem filial'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#8A90A0]">
          <span className="flex items-center gap-2 rounded-full bg-[#0C0D10] px-3 py-1.5 ring-1 ring-inset ring-[#23262F]">
            <UserIcon className="h-3.5 w-3.5 text-[#01B8FA]" />
            {user?.nome || 'Operador'}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[#8A90A0] transition-colors hover:bg-rose-50 hover:text-rose-600"
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
          <div className="border-b border-[#23262F] bg-[#101216] p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adicionarPorCodigo(codigo);
              }}
            >
              <div className="relative">
                <div className="flex items-center gap-3 rounded-2xl border border-[#23262F] bg-[#0C0D10] px-4 py-3.5 transition-all focus-within:border-[#01B8FA]/60 focus-within:bg-[#101216] focus-within:ring-4 focus-within:ring-[#01B8FA]/15">
                  {buscando ? (
                    <Loader2 className="h-6 w-6 shrink-0 animate-spin text-[#01B8FA]" />
                  ) : (
                    <ScanLine className="h-6 w-6 shrink-0 text-[#01B8FA]" />
                  )}
                  <input
                    ref={inputRef}
                    autoFocus
                    value={codigo}
                    onChange={(e) => {
                      const v = e.target.value;
                      // "2*arroz" / "2xarroz": assim que uma LETRA vem depois do
                      // multiplicador, tira o "2*" do campo e mostra embaixo
                      // "Próximo item × 2". O campo fica só com o nome (não gruda).
                      const m = v.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.*)$/);
                      if (m && /^\p{L}/u.test(m[2])) {
                        const n = parseNum(m[1]);
                        setMult(n > 0 ? n : 1);
                        setCodigo(m[2]);
                        return;
                      }
                      setCodigo(v);
                    }}
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
                    className="w-full bg-transparent text-lg outline-none placeholder:text-[#9CA3AF]"
                    autoComplete="off"
                  />
                </div>

                {/* Sugestões por nome/código */}
                {sugestoes.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-[#23262F] bg-[#101216] shadow-[0_8px_24px_rgba(22,23,29,0.12)]">
                    {sugestoes.map((p, idx) => (
                      <li
                        key={p.id}
                        onMouseDown={(e) => { e.preventDefault(); selecionarSugestao(p); }}
                        onMouseEnter={() => setSugIdx(idx)}
                        className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${
                          idx === sugIdx ? 'bg-[#01B8FA]/10' : 'hover:bg-[#0C0D10]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#F7F8FA]">{p.descricao}</div>
                          <div className="truncate text-xs text-[#8A90A0]">
                            {p.codigoBarras || p.codigo}
                            <span className={p.estoqueDisponivel > 0 ? 'text-[#8A90A0]' : 'text-rose-500'}>
                              {' · '}
                              {p.vendidoPorPeso
                                ? `${p.estoqueDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
                                : `${p.estoqueDisponivel} un`}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 tabular-nums text-sm font-semibold text-[#01B8FA]">
                          {brl(p.precoVenda)}
                          {p.vendidoPorPeso && <span className="text-xs text-[#8A90A0]">/kg</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
            {/* Multiplicador de quantidade — arma o PRÓXIMO item bipado.
                Clique um ×N ou digite "2*" antes do nome/código. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-[#8A90A0]">
                Multiplicar ×
              </span>
              {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => aplicarMultiplicador(n)}
                  className={`min-w-[2.75rem] rounded-xl border px-3 py-1.5 text-sm font-semibold tabular-nums transition ${
                    mult === n
                      ? 'border-[#01B8FA] bg-[#01B8FA]/10 text-[#2DD4A7]'
                      : 'border-[#23262F] bg-[#101216] text-[#8A90A0] hover:border-[#D1D5DB] hover:bg-[#0C0D10]'
                  }`}
                  title={`Próximo item entra com ${n} unidades`}
                >
                  ×{n}
                </button>
              ))}
              {mult > 1 && (
                <button
                  onClick={() => { setMult(1); focar(); }}
                  className="ml-1 flex items-center gap-1 rounded-xl bg-[#01B8FA]/10 px-3 py-1.5 text-sm font-semibold text-[#2DD4A7] ring-1 ring-inset ring-[#01B8FA]/30"
                  title="Próximo item terá esta quantidade. Clique para limpar."
                >
                  Próximo item × {mult} <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {aviso && (
              <div className="mt-2 text-sm font-medium text-rose-500">{aviso}</div>
            )}
          </div>

          {/* Itens */}
          <div className="min-h-0 flex-1 overflow-auto">
            {itens.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-[#8A90A0]">
                {ultimoCupom ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-[#01B8FA]/10 ring-1 ring-inset ring-[#01B8FA]/25">
                      <Check className="h-9 w-9 text-[#01B8FA]" />
                    </div>
                    <p className="text-lg font-semibold text-[#2DD4A7]">
                      Venda #{ultimoCupom.numero} registrada
                    </p>
                    <p className="mt-1 text-sm text-[#8A90A0]">
                      {brl(ultimoCupom.valorTotal)} · {ultimoCupom.formaPagamento}
                      {ultimoCupom.troco > 0 && ` · Troco ${brl(ultimoCupom.troco)}`}
                    </p>

                    {/* Situação fiscal (NFC-e) da venda: chave, QR e status SEFAZ. */}
                    {ultimaFiscal && (
                      <FiscalVendaStatus fiscal={ultimaFiscal} cupomFiscal={ultimoCupomFiscal} />
                    )}

                    <button
                      onClick={() => imprimirCupom(ultimoCupom)}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-[#101216] px-4 py-2.5 text-sm text-[#F7F8FA] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.98]"
                    >
                      <Printer className="h-4 w-4" /> Reimprimir cupom
                    </button>
                    <label
                      className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#8A90A0] select-none"
                      title="Ligue apenas se este caixa tem impressora térmica. Sem térmica, isto abre o diálogo de impressão do Chrome a cada venda."
                    >
                      <input
                        type="checkbox"
                        checked={cupomAuto}
                        onChange={(e) => {
                          setCupomAuto(e.target.checked);
                          setCupomAutoState(e.target.checked);
                        }}
                        className="h-4 w-4 accent-[#01B8FA]"
                      />
                      Imprimir cupom automaticamente
                    </label>
                    <p className="mt-3 text-sm text-[#8A90A0]">Bipe uma mercadoria para a próxima venda.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#101216] ring-1 ring-inset ring-[#23262F]">
                      <Barcode className="h-8 w-8 text-[#C4C6CB]" />
                    </div>
                    <p className="text-sm">Nenhum item. Bipe uma mercadoria para começar.</p>
                    <p className="mt-1 text-xs text-[#B0B2B7]">Use o leitor de código de barras ou digite o nome do produto.</p>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#0C0D10]/95 text-left text-[11px] font-semibold uppercase tracking-wide text-[#8A90A0] backdrop-blur">
                  <tr className="border-b border-[#23262F]">
                    <th className="px-4 py-2.5">Produto</th>
                    <th className="px-4 py-2.5 text-right">Preço</th>
                    <th className="px-4 py-2.5 text-center">Qtd</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => (
                    <tr
                      key={i.produtoId}
                      onClick={() => setSelecionadoId(i.produtoId)}
                      className={`cursor-pointer border-b border-[#EEF0F2] transition-colors ${
                        selecionadoId === i.produtoId ? 'bg-[#01B8FA]/[0.08] ring-1 ring-inset ring-[#01B8FA]/30' : 'hover:bg-[#0C0D10]'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.descricao}</div>
                        <div className="text-xs text-[#8A90A0]">{i.codigoBarras}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {brl(i.precoUnit)}
                      </td>
                      <td className="px-4 py-3">
                        {/* Quantidade é definida no momento do bipe (multiplicador).
                            Não se altera depois — anti-fraude. Para corrigir, remove
                            o item (com senha) e bipa de novo. */}
                        <div className="text-center">
                          <span className="inline-block min-w-[3.5rem] rounded-lg bg-[#0C0D10] px-3 py-1.5 text-center font-semibold tabular-nums text-[#F7F8FA] ring-1 ring-inset ring-[#23262F]">
                            {i.unidade === 'KG'
                              ? `${i.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
                              : i.quantidade}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {brl(i.precoUnit * i.quantidade)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => pedirGerencial('remover', 'Remover item da venda', () => remover(i.produtoId))}
                          className="rounded p-1 text-[#8A90A0] hover:bg-rose-50 hover:text-rose-600"
                          title="Remover item (pode exigir senha gerencial)"
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
        <aside className="flex w-80 shrink-0 flex-col border-l border-[#23262F] bg-[#101216]">
          <div className="flex-1 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8A90A0]">Itens</span>
              <span className="rounded-full bg-[#0C0D10] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#F7F8FA] ring-1 ring-inset ring-[#23262F]">{totalItens}</span>
            </div>
            {descontoValor > 0 && (
              <>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-[#8A90A0]">Subtotal</span>
                  <span className="tabular-nums text-[#8A90A0] line-through">{brl(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#01B8FA]">
                    Desconto{desconto.tipo === 'PERCENT' ? ` (${desconto.valor}%)` : ''}
                  </span>
                  <span className="tabular-nums text-[#01B8FA]">- {brl(descontoValor)}</span>
                </div>
              </>
            )}
            {/* Hero do total a pagar */}
            <div className="mt-4 rounded-2xl border border-[#01B8FA]/20 bg-[#01B8FA]/[0.06] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#01B8FA]">
                Total a pagar
              </div>
              <div className="mt-1 text-[2.75rem] font-bold leading-none tabular-nums text-[#01B8FA]">
                {brl(totalFinal)}
              </div>
            </div>
          </div>
          <div className="space-y-2 p-4">
            <button
              onClick={() => setPagando(true)}
              disabled={itens.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-4 text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
            >
              <Check className="h-5 w-5" />
              Finalizar (F2)
            </button>
            <button
              onClick={() => pedirGerencial('desconto', 'Aplicar desconto', () => setModalDesconto(true))}
              disabled={itens.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101216] py-2.5 text-sm text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.99] disabled:opacity-40"
            >
              <Percent className="h-4 w-4 text-[#01B8FA]" />
              {descontoValor > 0 ? 'Alterar desconto' : 'Desconto'} (F4)
            </button>
            <button
              onClick={() => pedirGerencial('cancelar', 'Cancelar venda', limpar)}
              disabled={itens.length === 0}
              className="w-full rounded-xl bg-transparent py-2 text-sm text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 active:scale-[0.99] disabled:opacity-40"
            >
              Cancelar venda
            </button>

            {/* Barra do caixa (turno) */}
            <div className="mt-2 border-t border-[#23262F] pt-3">
              {/* Identificação do caixa aberto — cada operador tem o SEU caixa. */}
              <div className="mb-3 rounded-xl border border-[#01B8FA]/20 bg-[#01B8FA]/[0.06] px-3.5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#2DD4A7]">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#01B8FA]/15 ring-1 ring-inset ring-[#01B8FA]/25">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  Caixa aberto às {horaHM(sessao.abertaEm)}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#8A90A0]">Saldo inicial</span>
                  <span className="tabular-nums font-semibold text-[#F7F8FA]">{brl(sessao.saldoInicial)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-[#8A90A0]">Operador</span>
                  <span className="flex items-center gap-1.5 font-semibold text-[#F7F8FA]">
                    <UserIcon className="h-3.5 w-3.5 text-[#01B8FA]" />
                    {sessao.operador || user?.nome || 'Operador'}
                  </span>
                </div>
              </div>
              <div className="mb-2 flex justify-between px-0.5 text-xs text-[#8A90A0]">
                <span>Turno · {sessao.qtdVendas} venda(s)</span>
                <span>Gaveta: {brl(sessao.dinheiroEsperadoGaveta)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => pedirGerencial('sangria', 'Sangria (retirada de caixa)', () => setModalCaixa('SANGRIA'))}
                  className="flex flex-col items-center gap-1 rounded-xl bg-[#101216] py-2.5 text-xs text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.97]"
                >
                  <ArrowDownCircle className="h-4 w-4 text-rose-500" /> Sangria
                  <span className="text-[10px] text-[#8A90A0]">F7</span>
                </button>
                <button
                  onClick={() => pedirGerencial('suprimento', 'Suprimento (reforço de troco)', () => setModalCaixa('SUPRIMENTO'))}
                  className="flex flex-col items-center gap-1 rounded-xl bg-[#101216] py-2.5 text-xs text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.97]"
                >
                  <ArrowUpCircle className="h-4 w-4 text-[#01B8FA]" /> Suprim.
                  <span className="text-[10px] text-[#8A90A0]">F8</span>
                </button>
                <button
                  onClick={() => pedirGerencial('fechar', 'Fechar caixa', () => setModalCaixa('FECHAR'))}
                  className="flex flex-col items-center gap-1 rounded-xl bg-[#101216] py-2.5 text-xs text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.97]"
                >
                  <Lock className="h-4 w-4 text-[#01B8FA]" /> Fechar
                  <span className="text-[10px] text-[#8A90A0]">F9</span>
                </button>
              </div>
              <button
                onClick={() => setModalVendas(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101216] py-2.5 text-xs text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.99]"
              >
                <Printer className="h-4 w-4 text-[#01B8FA]" /> Vendas / Reimprimir / Estorno
                <span className="text-[10px] text-[#8A90A0]">F10</span>
              </button>
              <button
                onClick={handleAbrirGaveta}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101216] py-2.5 text-xs text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#0C0D10] active:scale-[0.99]"
              >
                <Coins className="h-4 w-4 text-[#01B8FA]" /> Abrir gaveta
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
          pedirGerencial={pedirGerencial}
        />
      )}

      {modalCaixa === 'SANGRIA' && (
        <ModalValor
          titulo="Sangria (retirada)"
          cor="bg-rose-600 hover:bg-rose-700"
          icon={<ArrowDownCircle className="h-5 w-5 text-rose-500" />}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleSangria}
        />
      )}
      {modalCaixa === 'SUPRIMENTO' && (
        <ModalValor
          titulo="Suprimento (reforço)"
          cor="bg-[#01B8FA] hover:bg-[#0d7a64]"
          icon={<ArrowUpCircle className="h-5 w-5 text-[#01B8FA]" />}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleSuprimento}
        />
      )}
      {modalCaixa === 'FECHAR' && (
        <ModalFechar
          esperado={sessao.dinheiroEsperadoGaveta}
          esperadoCartao={sessao.totalCartao}
          esperadoPix={sessao.totalPix}
          onFechar={() => setModalCaixa(null)}
          onConfirmar={handleFechar}
        />
      )}

      {/* Portão por senha gerencial da loja (operações sensíveis) */}
      {gate && (
        <ModalSenhaGerencial
          acao={gate.label}
          filialId={filialAtiva?.id}
          onFechar={() => setGate(null)}
          onAutorizado={() => {
            const cb = gate.onOk;
            setGate(null);
            cb();
          }}
        />
      )}
    </div>
  );
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000; // preserva precisão de peso (kg)
const parseNum = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;
// Hora curta no padrão brasileiro do caixa: "7h03", "14h30".
const horaHM = (d: string | Date) => {
  const dt = new Date(d);
  return `${dt.getHours()}h${String(dt.getMinutes()).padStart(2, '0')}`;
};

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
    opts?: { cpfNota?: string },
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
  // CPF/CNPJ na nota (opcional) — vai para a NFC-e como consumidor identificado.
  const [cpfNota, setCpfNota] = useState('');
  const [pedirCpf, setPedirCpf] = useState(false);
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
    const res = await onConfirmar(lista, { cpfNota: cpfNota.replace(/\D/g, '') || undefined });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5 text-[#01B8FA]" /> Pagamento
          </h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-between rounded-xl border border-[#23262F] bg-[#0C0D10] px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A90A0]">Total</div>
              <div className="text-3xl font-bold tabular-nums text-[#F7F8FA]">{brl(total)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A90A0]">Restante</div>
              <div className={`text-3xl font-bold tabular-nums ${restante > 0.005 ? 'text-[#F7F8FA]' : 'text-[#01B8FA]'}`}>
                {brl(Math.max(0, restante))}
              </div>
            </div>
          </div>

          {/* Pagamentos já lançados (pagamento dividido) */}
          {pagamentos.length > 0 && (
            <div className="mt-4 space-y-1">
              {pagamentos.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-[#0C0D10] px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-[#F7F8FA]">
                      {p.forma.replace('_TEF', '').replace('_POS', '').replace('CARTAO', 'Cartão').replace('DINHEIRO', 'Dinheiro')}
                    </span>
                    {rotuloCanal(p.forma) && (
                      <span className="rounded bg-[#0C0D10] px-1.5 py-0.5 text-[10px] text-[#8A90A0]">{rotuloCanal(p.forma)}</span>
                    )}
                    {p.nsu && <span className="text-[10px] text-[#8A90A0]">NSU {p.nsu}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-[#8A90A0]">{brl(p.valor)}</span>
                    <button onClick={() => removerPagamento(idx)} className="text-[#8A90A0] hover:text-rose-600">
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
                className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm transition-all active:scale-[0.97] ${
                  forma === f.id
                    ? 'border-[#01B8FA] bg-[#01B8FA]/10 text-[#2DD4A7] ring-2 ring-inset ring-[#01B8FA]/30'
                    : 'border-[#23262F] text-[#8A90A0] hover:border-[#D1D5DB] hover:bg-[#0C0D10]'
                }`}
              >
                {f.icon}
                {f.label}
                <span className="text-[10px] text-[#8A90A0]">{f.tecla}</span>
              </button>
            ))}
          </div>

          {/* Canal TEF x POS (cartão/PIX) */}
          {forma !== 'DINHEIRO' && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-[#8A90A0]">Máquina:</span>
              <button
                onClick={() => setCanal('TEF')}
                disabled={!temTef}
                className={`rounded-md px-3 py-1 ${canal === 'TEF' ? 'bg-[#01B8FA] text-white' : 'bg-[#0C0D10] text-[#8A90A0]'} disabled:opacity-40`}
                title={temTef ? 'Máquina integrada (TEF) — F6' : 'Nenhum TEF configurado'}
              >
                Integrada (TEF)
              </button>
              <button
                onClick={() => setCanal('POS')}
                className={`rounded-md px-3 py-1 ${canal === 'POS' ? 'bg-[#01B8FA] text-white' : 'bg-[#0C0D10] text-[#8A90A0]'}`}
                title="Maquininha avulsa — operar na mão (F6)"
              >
                Avulsa (POS)
              </button>
              {forma === 'CARTAO' && canal === 'TEF' && (
                <span className="ml-auto flex gap-1">
                  <button
                    onClick={() => setTipoCartao('CREDITO')}
                    className={`rounded px-2 py-1 text-xs ${tipoCartao === 'CREDITO' ? 'bg-[#01B8FA]/10 text-[#2DD4A7]' : 'bg-[#0C0D10] text-[#8A90A0]'}`}
                  >Crédito</button>
                  <button
                    onClick={() => setTipoCartao('DEBITO')}
                    className={`rounded px-2 py-1 text-xs ${tipoCartao === 'DEBITO' ? 'bg-[#01B8FA]/10 text-[#2DD4A7]' : 'bg-[#0C0D10] text-[#8A90A0]'}`}
                  >Débito</button>
                </span>
              )}
            </div>
          )}

          {/* Valor da parcela + (dinheiro) valor recebido */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8A90A0]">Valor {pagamentos.length > 0 || valorStr ? 'a lançar' : '(total)'}</label>
              <input
                ref={valorRef}
                autoFocus={forma !== 'DINHEIRO'}
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                placeholder={brl(restante).replace('R$', '').trim()}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2.5 text-lg outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
              />
            </div>
            {forma === 'DINHEIRO' && (
              <div>
                <label className="text-xs text-[#8A90A0]">Valor recebido</label>
                <input
                  autoFocus
                  value={recebidoStr}
                  onChange={(e) => setRecebidoStr(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2.5 text-lg outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
                />
              </div>
            )}
          </div>

          {(trocoAtual > 0 || trocoAcum > 0 || dinheiroInsuficiente) && (
            <div className="mt-2 flex justify-between text-sm">
              {dinheiroInsuficiente ? (
                <span className="text-rose-600">Recebido menor que o valor</span>
              ) : (
                <span className="text-[#8A90A0]">&nbsp;</span>
              )}
              <span className="text-[#01B8FA]">Troco: {brl(round2(trocoAtual + trocoAcum))}</span>
            </div>
          )}

          {processando && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#01B8FA]/10 px-3 py-2 text-sm text-[#2DD4A7]">
              <Loader2 className="h-4 w-4 animate-spin" /> {processando}
            </div>
          )}
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{erro}</div>
          )}

          {/* CPF/CNPJ na nota (opcional) — identifica o consumidor na NFC-e */}
          <div className="mt-4">
            {!pedirCpf ? (
              <button
                onClick={() => setPedirCpf(true)}
                className="flex items-center gap-2 text-sm text-[#8A90A0] hover:text-[#01B8FA]"
              >
                <UserIcon className="h-4 w-4" /> Incluir CPF/CNPJ na nota
              </button>
            ) : (
              <div>
                <label className="flex items-center gap-2 text-xs text-[#8A90A0]">
                  <UserIcon className="h-4 w-4" /> CPF/CNPJ do consumidor (opcional)
                </label>
                <input
                  autoFocus
                  value={cpfNota}
                  onChange={(e) => setCpfNota(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2 text-base outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
                />
              </div>
            )}
          </div>

          <button
            onClick={adicionar}
            disabled={salvando || !!processando || restante <= 0.005 || valorAplicado <= 0 || dinheiroInsuficiente}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-4 text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Percent className="h-5 w-5 text-[#01B8FA]" /> Desconto na venda
          </h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4 flex justify-between text-sm">
            <span className="text-[#8A90A0]">Total atual</span>
            <span className="tabular-nums text-[#8A90A0]">{brl(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipo('PERCENT')}
              className={`rounded-xl border py-2 text-sm transition-all active:scale-[0.97] ${
                tipo === 'PERCENT'
                  ? 'border-[#01B8FA] bg-[#01B8FA]/10 text-[#2DD4A7] ring-2 ring-inset ring-[#01B8FA]/30'
                  : 'border-[#23262F] text-[#8A90A0] hover:border-[#D1D5DB] hover:bg-[#0C0D10]'
              }`}
            >
              Percentual (%)
            </button>
            <button
              onClick={() => setTipo('VALOR')}
              className={`rounded-xl border py-2 text-sm transition-all active:scale-[0.97] ${
                tipo === 'VALOR'
                  ? 'border-[#01B8FA] bg-[#01B8FA]/10 text-[#2DD4A7] ring-2 ring-inset ring-[#01B8FA]/30'
                  : 'border-[#23262F] text-[#8A90A0] hover:border-[#D1D5DB] hover:bg-[#0C0D10]'
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
            className="mt-4 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2.5 text-lg outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A90A0]">Desconto</span>
              <span className="tabular-nums text-[#01B8FA]">- {brl(descontoValor)} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A90A0]">Novo total</span>
              <span className="tabular-nums font-semibold text-[#01B8FA]">{brl(totalFinal)}</span>
            </div>
          </div>

          {excede && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">
              Desconto acima do limite do operador ({DESCONTO_MAX_PCT}%). Chame o gerente.
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => onConfirmar({ tipo: 'VALOR', valor: 0 })}
              className="flex-1 rounded-xl bg-[#0C0D10] py-3 text-sm text-[#8A90A0] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#EEF0F2] active:scale-[0.98]"
            >
              Remover
            </button>
            <button
              onClick={confirmar}
              disabled={excede}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-3 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-5 w-5 text-[#01B8FA]" /> Pesar produto
          </h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-1 text-sm font-medium text-[#F7F8FA]">{descricao}</div>
          <div className="mb-4 text-sm text-[#8A90A0]">
            {brl(precoUnit)} / {unidade || 'KG'}
          </div>

          <label className="flex items-center justify-between text-xs uppercase tracking-wide text-[#8A90A0]">
            <span>Peso ({unidade || 'KG'})</span>
            {multQtd > 1 && (
              <span className="rounded bg-[#01B8FA]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2DD4A7]">
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
            className="mt-1 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2.5 text-lg outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
          />

          <div className="mt-4 flex justify-between text-sm">
            <span className="text-[#8A90A0]">
              Subtotal{multQtd > 1 ? ` (${kg > 0 ? kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : 0} kg × ${multQtd})` : ''}
            </span>
            <span className="tabular-nums font-semibold text-[#01B8FA]">{brl(subtotal)}</span>
          </div>

          <button
            onClick={confirmar}
            disabled={!(kg > 0)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-3 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#23262F] disabled:text-[#B0B2B7] disabled:shadow-none"
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
  pedirGerencial,
}: {
  filialId?: string;
  onFechar: () => void;
  onEstornou: () => void;
  pedirGerencial: (acao: AcaoGerencial, label: string, onOk: () => void) => void;
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

  // Estorno é operação sensível: pede confirmação e, em seguida, a senha
  // gerencial da loja (se exigida) antes de reverter estoque + caixa + NFC-e.
  function estornar(v: VendaRecente) {
    if (
      !window.confirm(
        `Estornar a venda #${v.numero} (${brl(v.valorTotal)})?\nIsso devolve o estoque e reverte a entrada no caixa.`,
      )
    )
      return;
    pedirGerencial('estorno', `Estorno da venda #${v.numero}`, () => void doEstornar(v));
  }

  async function doEstornar(v: VendaRecente) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-[#01B8FA]" /> Vendas recentes
          </h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {erro && (
            <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">{erro}</div>
          )}
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#01B8FA]" />
            </div>
          ) : vendas.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#8A90A0]">Nenhuma venda registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-[#8A90A0]">
                <tr className="border-b border-[#23262F]">
                  <th className="px-2 py-2">Nº</th>
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Forma</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.pedidoId} className="border-b border-[#EEF0F2] transition-colors hover:bg-[#0C0D10]">
                    <td className="px-2 py-2 font-medium">#{v.numero}</td>
                    <td className="px-2 py-2 text-[#8A90A0]">
                      {new Date(v.dataEmissao).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2 text-[#8A90A0]">{v.formaPagamento || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {brl(v.valorTotal)}
                      {v.estornada && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                          ESTORNADA
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => reimprimir(v)}
                          disabled={busy === v.pedidoId}
                          className="flex items-center gap-1 rounded-lg bg-[#0C0D10] px-2.5 py-1.5 text-xs text-[#F7F8FA] ring-1 ring-inset ring-[#23262F] transition-all hover:bg-[#EEF0F2] active:scale-[0.97] disabled:opacity-40"
                        >
                          <Printer className="h-3.5 w-3.5" /> Reimprimir
                        </button>
                        {!v.estornada && (
                          <button
                            onClick={() => estornar(v)}
                            disabled={busy === v.pedidoId}
                            className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 ring-1 ring-inset ring-rose-200 transition-all hover:bg-rose-100 active:scale-[0.97] disabled:opacity-40"
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

/** QR Code renderizado a partir de um texto/URL (gera data-URL em efeito). */
function QRImg({ texto, size = 132 }: { texto: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(texto, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' })
      .then((url) => vivo && setSrc(url))
      .catch(() => vivo && setSrc(null));
    return () => {
      vivo = false;
    };
  }, [texto, size]);
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="QR Code NFC-e"
      className="rounded-lg bg-[#101216] p-1.5 ring-1 ring-inset ring-[#23262F]"
    />
  );
}

/** Formata a chave de acesso (44 dígitos) em grupos de 4 p/ leitura humana. */
function fmtChave(chave?: string | null): string {
  const c = (chave || '').replace(/\D/g, '');
  if (c.length !== 44) return chave || '';
  return c.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Bloco de situação fiscal (NFC-e) mostrado no painel de venda concluída. */
function FiscalVendaStatus({
  fiscal,
  cupomFiscal,
}: {
  fiscal: DadosFiscais;
  cupomFiscal: CupomFiscalImpressao | null;
}) {
  const emitido = fiscal.status === 'EMITIDO' || !!fiscal.chaveAcesso;
  const pendente = !emitido && (fiscal.status === 'PENDENTE' || fiscal.status === 'CONTINGENCIA');
  const falhou = !emitido && !pendente;

  if (emitido) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-2xl border border-[#01B8FA]/25 bg-[#01B8FA]/[0.06] p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#2DD4A7]">
          <ShieldCheck className="h-4 w-4" /> NFC-e autorizada
          {fiscal.simulacao && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
              HOMOLOGAÇÃO
            </span>
          )}
        </div>
        {(fiscal.numero || fiscal.serie) && (
          <div className="mt-1 text-xs text-[#8A90A0]">
            Nº {fiscal.numero ?? '—'} · Série {fiscal.serie ?? '—'}
          </div>
        )}
        {fiscal.chaveAcesso && (
          <div className="mt-2 break-all px-2 font-mono text-[11px] leading-tight text-[#8A90A0]">
            {fmtChave(fiscal.chaveAcesso)}
          </div>
        )}
        {(fiscal.qrCode || fiscal.urlConsulta) && (
          <div className="mt-3 flex justify-center">
            <QRImg texto={fiscal.qrCode || fiscal.urlConsulta || ''} />
          </div>
        )}
        {cupomFiscal && (
          <button
            onClick={() => void imprimirCupomFiscal(cupomFiscal)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99]"
          >
            <FileText className="h-4 w-4" /> Imprimir cupom fiscal (NFC-e)
          </button>
        )}
      </div>
    );
  }

  if (pendente) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-700">
          <AlertTriangle className="h-4 w-4" /> NFC-e pendente de envio
        </div>
        <p className="mt-1 text-xs text-[#8A90A0]">
          A venda foi registrada e a nota ficou salva para reenvio automático ao SEFAZ.
          Acompanhe no Monitor Fiscal.
        </p>
        {fiscal.erro && <p className="mt-2 text-[11px] text-amber-600">{fiscal.erro}</p>}
      </div>
    );
  }

  if (falhou) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-2xl border border-rose-300 bg-rose-50 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-rose-700">
          <AlertTriangle className="h-4 w-4" /> NFC-e não emitida
        </div>
        <p className="mt-1 text-xs text-[#8A90A0]">
          A venda está salva. Tente reemitir pelo Monitor Fiscal.
        </p>
        {fiscal.erro && <p className="mt-2 text-[11px] text-rose-600">{fiscal.erro}</p>}
      </div>
    );
  }

  return null;
}

/**
 * Modal de autorização por SENHA GERENCIAL interna da loja (modelo simples do
 * mercadinho). Uma única senha por filial libera operações sensíveis — sem
 * precisar do e-mail/senha de um usuário supervisor.
 */
function ModalSenhaGerencial({
  acao,
  filialId,
  onFechar,
  onAutorizado,
}: {
  acao: string;
  filialId?: string;
  onFechar: () => void;
  onAutorizado: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  async function validar() {
    if (!senha) {
      setErro('Informe a senha gerencial.');
      return;
    }
    if (!filialId) {
      setErro('Filial não identificada.');
      return;
    }
    setValidando(true);
    setErro(null);
    try {
      await pdvApi.autorizarGerencial({ filialId, senha, acao });
      onAutorizado();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Senha gerencial incorreta.';
      setErro(Array.isArray(msg) ? msg[0] : msg);
      setValidando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#23262F] bg-[#101216] shadow-[0_20px_60px_-20px_rgba(22,23,29,0.25)]">
        <div className="flex items-center justify-between border-b border-[#23262F] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-[#01B8FA]" /> Senha gerencial
          </h2>
          <button onClick={onFechar} className="rounded-lg p-1 text-[#8A90A0] transition-colors hover:bg-[#0C0D10] hover:text-[#F7F8FA]" title="Fechar (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-[#8A90A0]">
            Operação sensível: <span className="font-medium text-[#F7F8FA]">{acao}</span>.
            Peça ao responsável a senha gerencial da loja para continuar.
          </p>
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8A90A0]">Senha gerencial</label>
            <input
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && validar()}
              placeholder="••••••••"
              // NÃO usar type="password": isso faz o Chrome/gerenciadores oferecerem
              // "salvar senha" toda vez, pois tratam como login de conta. Isto é só
              // uma autorização de ação da loja. Mascaramos com CSS (text-security)
              // e sinalizamos aos gerenciadores para ignorar o campo.
              type="text"
              name="lumin-autorizacao-gerencial"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              style={{ WebkitTextSecurity: 'disc' } as any}
              className="mt-1.5 w-full rounded-xl border border-[#23262F] bg-[#0C0D10] px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none transition-all focus:border-[#01B8FA]/60 focus:bg-[#101216] focus:ring-4 focus:ring-[#01B8FA]/15"
            />
          </div>
          {erro && (
            <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-200">{erro}</div>
          )}
          <button
            onClick={validar}
            disabled={validando}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#01B8FA] py-3 text-base font-semibold text-white shadow-[0_10px_24px_-12px_rgba(47,95,224,0.6)] transition-all hover:bg-[#0d7a64] active:scale-[0.99] disabled:opacity-50"
          >
            {validando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
            {validando ? 'Validando...' : 'Liberar'}
          </button>
        </div>
      </div>
    </div>
  );
}
