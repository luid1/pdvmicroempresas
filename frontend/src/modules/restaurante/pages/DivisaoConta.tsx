import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SplitSquareHorizontal, Users, Minus, Plus, Equal, ListChecks, Check, Percent,
  RefreshCw, AlertCircle, Loader2, Wallet, CreditCard, QrCode,
} from 'lucide-react';
import { restauranteApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * DIVISÃO DE CONTA (modo Restaurante) — fecha uma comanda dividindo o total.
 *
 * Ligado ao backend: carrega as comandas abertas da filial; o operador escolhe
 * a comanda e a forma de pagamento. O cálculo da divisão (por igual / por item)
 * é feito no cliente — é só uma ajuda visual para combinar quem paga o quê.
 * "Fechar conta e receber" fecha a comanda de verdade (aplica a taxa de 10% se
 * marcada) e lança a venda no caixa aberto (relatório X/Z e saldo da gaveta).
 *
 * Dois modos:
 *   • IGUAL   → divide o total (com taxa) pelo nº de pessoas.
 *   • POR ITEM → cada item é atribuído a uma ou mais pessoas; item compartilhado
 *                rateia igual entre os marcados; a taxa rateia por consumo.
 */

type Origem = 'MESA' | 'BALCAO' | 'DELIVERY';
type Forma = 'DINHEIRO' | 'CARTAO' | 'PIX';
type Modo = 'IGUAL' | 'ITEM';

interface ItemComandaApi {
  id: string;
  descricao: string;
  quantidade: string | number;
  precoUnitario: string | number;
}
interface ComandaApi {
  id: string;
  numero: number;
  origem: Origem;
  clienteNome?: string | null;
  pessoas?: number | null;
  itens: ItemComandaApi[];
  mesa?: { numero: number } | null;
}

interface ItemVM { id: string; nome: string; qtd: number; preco: number }
interface ComandaVM {
  id: string;
  numero: number;
  referencia: string;
  pessoas: number;
  itens: ItemVM[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number | null | undefined) => Number(v ?? 0);

const NOMES = ['Pessoa 1', 'Pessoa 2', 'Pessoa 3', 'Pessoa 4', 'Pessoa 5', 'Pessoa 6'];
const CORES = ['#01B8FA', '#2DD4A7', '#0E86D4', '#FF6B7A', '#7c3aed', '#0678a0'];

const FORMAS: { id: Forma; label: string; icon: React.ElementType }[] = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: Wallet },
  { id: 'CARTAO', label: 'Cartão', icon: CreditCard },
  { id: 'PIX', label: 'Pix', icon: QrCode },
];

function referencia(c: ComandaApi): string {
  if (c.origem === 'MESA') return c.mesa ? `Mesa ${c.mesa.numero}` : `Mesa (CMD-${c.numero})`;
  if (c.origem === 'DELIVERY') return c.clienteNome ? `Delivery · ${c.clienteNome}` : `Delivery #${c.numero}`;
  return c.clienteNome || `Balcão #${c.numero}`;
}

export default function DivisaoConta() {
  const { filialAtiva } = useAuth();
  const filialId = filialAtiva?.id;

  const [comandas, setComandas] = useState<ComandaVM[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modo, setModo] = useState<Modo>('IGUAL');
  const [pessoas, setPessoas] = useState(2);
  const [taxa, setTaxa] = useState(true);
  const [forma, setForma] = useState<Forma>('DINHEIRO');
  // Modo POR ITEM: mapa itemId -> índices de pessoas que consumiram.
  const [atrib, setAtrib] = useState<Record<string, number[]>>({});

  const carregar = useCallback(async () => {
    if (!filialId) return;
    setErro(null);
    try {
      const [rAbertas, rFechando] = await Promise.all([
        restauranteApi.listarComandas({ filialId, status: 'ABERTA' }),
        restauranteApi.listarComandas({ filialId, status: 'FECHANDO' }),
      ]);
      const lista: ComandaApi[] = [...(rAbertas.data ?? []), ...(rFechando.data ?? [])];
      const vms: ComandaVM[] = lista.map((c) => ({
        id: c.id,
        numero: c.numero,
        referencia: referencia(c),
        pessoas: Math.max(1, Math.min(6, c.pessoas ?? 2)),
        itens: (c.itens ?? []).map((i) => ({
          id: i.id,
          nome: i.descricao,
          qtd: num(i.quantidade),
          preco: num(i.precoUnitario),
        })),
      }));
      setComandas(vms);
      setSelId((prev) => (prev && vms.some((v) => v.id === prev) ? prev : vms[0]?.id ?? null));
    } catch {
      setErro('Não consegui carregar as comandas. Verifique a conexão e tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [filialId]);

  useEffect(() => { setCarregando(true); void carregar(); }, [carregar]);

  const sel = useMemo(() => comandas.find((c) => c.id === selId) ?? null, [comandas, selId]);

  // Ao trocar de comanda: reseta atribuições e ajusta o nº de pessoas sugerido.
  useEffect(() => {
    setAtrib({});
    if (sel) setPessoas(sel.pessoas);
  }, [sel]);

  const itens = sel?.itens ?? [];
  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.preco * i.qtd, 0), [itens]);
  const valorTaxa = taxa ? subtotal * 0.1 : 0;
  const total = subtotal + valorTaxa;
  const porPessoaIgual = pessoas > 0 ? total / pessoas : 0;

  // Modo POR ITEM: soma por pessoa (item compartilhado rateia igual entre os marcados).
  const totaisPorItem = useMemo(() => {
    const soma = Array(pessoas).fill(0) as number[];
    let semDono = 0;
    for (const item of itens) {
      const donos = (atrib[item.id] || []).filter((p) => p < pessoas);
      const valorItem = item.preco * item.qtd;
      if (donos.length === 0) { semDono += valorItem; continue; }
      const cota = valorItem / donos.length;
      donos.forEach((p) => { soma[p] += cota; });
    }
    const consumido = soma.reduce((a, b) => a + b, 0);
    const comTaxa = soma.map((v) => v + (consumido > 0 ? (v / consumido) * valorTaxa : 0));
    return { soma: comTaxa, semDono };
  }, [atrib, pessoas, valorTaxa, itens]);

  const togglePessoaNoItem = (itemId: string, pessoaIdx: number) =>
    setAtrib((prev) => {
      const atual = prev[itemId] || [];
      const novo = atual.includes(pessoaIdx)
        ? atual.filter((p) => p !== pessoaIdx)
        : [...atual, pessoaIdx];
      return { ...prev, [itemId]: novo };
    });

  const fecharConta = useCallback(async () => {
    if (!sel || busy) return;
    if (itens.length === 0) { setErro('A comanda não tem itens para receber.'); return; }
    setBusy(true);
    setErro(null);
    try {
      await restauranteApi.fecharComanda(sel.id, { aplicarTaxa10: taxa, formaPagamento: forma });
      await carregar();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Não consegui fechar a conta. Confira se há um caixa aberto e tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [sel, busy, itens.length, taxa, forma, carregar]);

  const tituloRef = sel ? sel.referencia : '—';

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <SplitSquareHorizontal className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Divisão de Conta — {tituloRef}</h1>
            <p className="text-[11px] text-[#8A90A0]">
              {sel ? `Total ${brl(total)} · ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}` : 'Escolha uma comanda para dividir'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de comanda */}
          <select
            value={selId ?? ''}
            onChange={(e) => setSelId(e.target.value || null)}
            disabled={!comandas.length}
            className="text-xs rounded-lg px-3 py-2 text-[#8A90A0] bg-[#0C0D10] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50 disabled:opacity-50 max-w-[220px]"
          >
            {comandas.length === 0 && <option value="">Nenhuma comanda aberta</option>}
            {comandas.map((c) => (
              <option key={c.id} value={c.id}>{c.referencia}</option>
            ))}
          </select>
          <button
            onClick={() => { setCarregando(true); void carregar(); }}
            disabled={busy || carregando}
            title="Atualizar"
            className="h-9 w-9 rounded-lg bg-[#0C0D10] border border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40 flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
          </button>
          {/* Alternância de modo */}
          <div className="flex items-center gap-1 bg-[#0C0D10] rounded-lg p-0.5">
            <BotaoModo ativo={modo === 'IGUAL'} onClick={() => setModo('IGUAL')} icon={Equal} label="Por igual" />
            <BotaoModo ativo={modo === 'ITEM'} onClick={() => setModo('ITEM')} icon={ListChecks} label="Por item" />
          </div>
        </div>
      </div>

      {erro && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-[#FF6B7A]/25 bg-[#FF6B7A]/12 px-3 py-2 text-[12px] text-[#FF6B7A]">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex-1 overflow-auto p-5">
        {!filialId ? (
          <div className="text-center py-16 text-[#8A90A0] text-sm">Selecione uma filial para dividir contas.</div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-20 text-[#8A90A0] text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando comandas…
          </div>
        ) : !sel ? (
          <div className="text-center py-16 text-[#8A90A0] text-sm">Nenhuma comanda aberta para dividir.</div>
        ) : (
          <div className="max-w-5xl mx-auto grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            {/* Coluna esquerda: itens da comanda */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">Itens da comanda</h2>
              <div className="rounded-2xl border border-[#23262F] bg-[#101216] overflow-hidden">
                {itens.length === 0 && (
                  <div className="px-4 py-8 text-center text-[11px] text-[#8A90A0]">Esta comanda ainda não tem itens.</div>
                )}
                {itens.map((i) => (
                  <div key={i.id} className="px-4 py-3 border-b border-[#23262F] last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#F7F8FA] text-sm">{i.nome}</p>
                        <p className="text-[11px] text-[#8A90A0]">{i.qtd}× {brl(i.preco)}</p>
                      </div>
                      <span className="font-bold text-[#F7F8FA]">{brl(i.preco * i.qtd)}</span>
                    </div>
                    {modo === 'ITEM' && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {Array.from({ length: pessoas }).map((_, p) => {
                          const sel2 = (atrib[i.id] || []).includes(p);
                          return (
                            <button
                              key={p}
                              onClick={() => togglePessoaNoItem(i.id, p)}
                              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border transition-all ${
                                sel2 ? 'text-white border-transparent' : 'text-[#8A90A0] border-[#23262F] hover:border-[#01B8FA]/40'
                              }`}
                              style={sel2 ? { backgroundColor: CORES[p % CORES.length] } : undefined}
                            >
                              {sel2 && <Check className="h-3 w-3" />} {NOMES[p]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                <div className="px-4 py-3 bg-[#0C0D10] space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-[#8A90A0]">
                    <span>Subtotal</span><span>{brl(subtotal)}</span>
                  </div>
                  <button onClick={() => setTaxa(!taxa)} className="w-full flex items-center justify-between text-sm text-[#8A90A0]">
                    <span className="flex items-center gap-2">
                      <span className={`h-4 w-4 rounded border flex items-center justify-center ${taxa ? 'bg-[#01B8FA] border-[#01B8FA]' : 'border-[#5E6472]'}`}>
                        {taxa && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <Percent className="h-3.5 w-3.5" /> Taxa de serviço (10%)
                    </span>
                    <span>{brl(valorTaxa)}</span>
                  </button>
                  <div className="flex items-center justify-between text-base font-black text-[#F7F8FA] pt-1.5 border-t border-[#23262F]">
                    <span>Total</span><span>{brl(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita: resultado da divisão */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">
                {modo === 'IGUAL' ? 'Divisão por igual' : 'Quanto cada um paga'}
              </h2>

              {modo === 'IGUAL' ? (
                <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-[#8A90A0]"><Users className="h-4 w-4" /> Pessoas na mesa</span>
                    <div className="flex items-center gap-2 rounded-lg border border-[#23262F] px-1">
                      <button onClick={() => setPessoas((n) => Math.max(1, n - 1))} className="h-8 w-8 flex items-center justify-center text-[#8A90A0] hover:text-[#F7F8FA]"><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center font-bold text-[#F7F8FA]">{pessoas}</span>
                      <button onClick={() => setPessoas((n) => Math.min(6, n + 1))} className="h-8 w-8 flex items-center justify-center text-[#8A90A0] hover:text-[#F7F8FA]"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl bg-[#01B8FA]/[0.06] border border-[#01B8FA]/25 p-5 text-center">
                    <p className="text-[11px] text-[#01B8FA] uppercase tracking-wide font-bold">Cada pessoa paga</p>
                    <p className="text-4xl font-black text-[#F7F8FA] mt-1">{brl(porPessoaIgual)}</p>
                    <p className="text-[11px] text-[#8A90A0] mt-1">{brl(total)} ÷ {pessoas} pessoas</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#23262F] bg-[#101216] p-3">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="flex items-center gap-2 text-sm text-[#8A90A0]"><Users className="h-4 w-4" /> Pessoas</span>
                    <div className="flex items-center gap-2 rounded-lg border border-[#23262F] px-1">
                      <button onClick={() => setPessoas((n) => Math.max(1, n - 1))} className="h-7 w-7 flex items-center justify-center text-[#8A90A0]"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-5 text-center font-bold text-[#F7F8FA]">{pessoas}</span>
                      <button onClick={() => setPessoas((n) => Math.min(6, n + 1))} className="h-7 w-7 flex items-center justify-center text-[#8A90A0]"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-1 space-y-1.5">
                    {Array.from({ length: pessoas }).map((_, p) => (
                      <div key={p} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#23262F]">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#F7F8FA]">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CORES[p % CORES.length] }} />
                          {NOMES[p]}
                        </span>
                        <span className="font-black text-[#F7F8FA]">{brl(totaisPorItem.soma[p] || 0)}</span>
                      </div>
                    ))}
                  </div>
                  {totaisPorItem.semDono > 0 && (
                    <p className="text-[11px] text-[#FF6B7A] mt-2 px-2">
                      {brl(totaisPorItem.semDono)} ainda sem dono — marque quem consumiu.
                    </p>
                  )}
                </div>
              )}

              {/* Forma de pagamento */}
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mt-4 mb-2">Forma de pagamento</h2>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS.map((f) => {
                  const Icon = f.icon;
                  const ativo = forma === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setForma(f.id)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        ativo
                          ? 'bg-[#01B8FA]/[0.10] border-[#01B8FA]/45 text-[#01B8FA]'
                          : 'bg-[#101216] border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/30'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {f.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={fecharConta}
                disabled={busy || itens.length === 0}
                className="w-full mt-4 flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Fechando…' : `Fechar conta e receber · ${brl(total)}`}
              </button>
              <p className="text-[10px] text-[#8A90A0] text-center mt-2">
                O recebimento entra no caixa aberto (relatório X/Z). A divisão acima é só um guia para combinar quem paga o quê.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoModo({
  ativo, onClick, icon: Icon, label,
}: { ativo: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
        ativo ? 'bg-[#101216] text-[#01B8FA] shadow-sm' : 'text-[#8A90A0] hover:text-[#F7F8FA]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
