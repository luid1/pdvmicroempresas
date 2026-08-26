import { useMemo, useState } from 'react';
import {
  QrCode, Plus, Minus, ShoppingBag, X, Check, Pizza, Sandwich, CupSoda,
  IceCream, Layers, ChevronRight,
} from 'lucide-react';

/**
 * CARDÁPIO DIGITAL (modo Restaurante) — o que o cliente vê ao ler o QR da mesa.
 *
 * Reúne, num fluxo só, os recursos da Fase 5/6:
 *   • adicionais / modificadores por item;
 *   • PIZZA MEIO A MEIO (dois sabores, cobra o mais caro);
 *   • combos;
 *   • observações do cliente;
 *   • taxa de serviço (10%) opcional no fechamento.
 *
 * Fase 6: mock 100% frontend. No servidor, o pedido cai direto na comanda da
 * mesa e na cozinha (KDS).
 */

type CatId = 'pizzas' | 'lanches' | 'bebidas' | 'combos' | 'sobremesas';

interface Adicional { id: string; nome: string; preco: number; }
interface ItemCardapio {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  emoji: string;
  cat: CatId;
  meioAMeio?: boolean;             // pizzas: permite 2 sabores
  adicionais?: Adicional[];
}
interface ItemCarrinho {
  uid: string;
  base: ItemCardapio;
  qtd: number;
  segundoSabor?: ItemCardapio;     // meio a meio
  adicionais: Adicional[];
  obs: string;
  unit: number;                    // preço unitário já com adicionais/meio-a-meio
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIAS: { id: CatId; label: string; icon: React.ElementType }[] = [
  { id: 'pizzas', label: 'Pizzas', icon: Pizza },
  { id: 'lanches', label: 'Lanches', icon: Sandwich },
  { id: 'combos', label: 'Combos', icon: Layers },
  { id: 'bebidas', label: 'Bebidas', icon: CupSoda },
  { id: 'sobremesas', label: 'Sobremesas', icon: IceCream },
];

const ADIC_PIZZA: Adicional[] = [
  { id: 'borda', nome: 'Borda recheada (catupiry)', preco: 8 },
  { id: 'extra-queijo', nome: 'Extra queijo', preco: 6 },
  { id: 'bacon', nome: 'Bacon', preco: 5 },
];
const ADIC_LANCHE: Adicional[] = [
  { id: 'bacon', nome: 'Bacon extra', preco: 4 },
  { id: 'queijo', nome: 'Queijo extra', preco: 3.5 },
  { id: 'ovo', nome: 'Ovo', preco: 2.5 },
  { id: 'cheddar', nome: 'Cheddar cremoso', preco: 4 },
];

const CARDAPIO: ItemCardapio[] = [
  { id: 1, nome: 'Pizza Calabresa', descricao: 'Molho, muçarela, calabresa e cebola', preco: 49.9, emoji: '🍕', cat: 'pizzas', meioAMeio: true, adicionais: ADIC_PIZZA },
  { id: 2, nome: 'Pizza 4 Queijos', descricao: 'Muçarela, provolone, parmesão e catupiry', preco: 54.9, emoji: '🍕', cat: 'pizzas', meioAMeio: true, adicionais: ADIC_PIZZA },
  { id: 3, nome: 'Pizza Portuguesa', descricao: 'Presunto, ovo, cebola, ervilha e muçarela', preco: 52.9, emoji: '🍕', cat: 'pizzas', meioAMeio: true, adicionais: ADIC_PIZZA },
  { id: 4, nome: 'Pizza Marguerita', descricao: 'Muçarela, tomate e manjericão', preco: 47.9, emoji: '🍕', cat: 'pizzas', meioAMeio: true, adicionais: ADIC_PIZZA },
  { id: 10, nome: 'X-Bacon Artesanal', descricao: 'Blend 180g, bacon, cheddar e molho da casa', preco: 28.0, emoji: '🍔', cat: 'lanches', adicionais: ADIC_LANCHE },
  { id: 11, nome: 'X-Salada', descricao: 'Blend 150g, queijo, alface e tomate', preco: 24.0, emoji: '🍔', cat: 'lanches', adicionais: ADIC_LANCHE },
  { id: 12, nome: 'Smash Duplo', descricao: 'Dois blends smash, cheddar duplo e picles', preco: 32.0, emoji: '🍔', cat: 'lanches', adicionais: ADIC_LANCHE },
  { id: 20, nome: 'Combo Casal', descricao: '2 lanches + 2 batatas + 2 refris', preco: 79.9, emoji: '🍟', cat: 'combos' },
  { id: 21, nome: 'Combo Pizza Night', descricao: 'Pizza G + refri 2L + sobremesa', preco: 74.9, emoji: '🍕', cat: 'combos' },
  { id: 30, nome: 'Refrigerante Lata', descricao: '350ml — cola, guaraná ou laranja', preco: 6.0, emoji: '🥤', cat: 'bebidas' },
  { id: 31, nome: 'Refrigerante 2L', descricao: 'Cola, guaraná ou laranja', preco: 12.0, emoji: '🥤', cat: 'bebidas' },
  { id: 32, nome: 'Suco Natural', descricao: 'Laranja, limão ou maracujá — 500ml', preco: 9.0, emoji: '🧃', cat: 'bebidas' },
  { id: 40, nome: 'Pudim', descricao: 'Fatia de pudim de leite', preco: 11.0, emoji: '🍮', cat: 'sobremesas' },
  { id: 41, nome: 'Petit Gâteau', descricao: 'Com sorvete de creme', preco: 16.0, emoji: '🍫', cat: 'sobremesas' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

// Preço unitário: base (ou o mais caro no meio-a-meio) + adicionais.
function precoUnit(base: ItemCardapio, segundo: ItemCardapio | undefined, adic: Adicional[]) {
  const principal = segundo ? Math.max(base.preco, segundo.preco) : base.preco;
  return principal + adic.reduce((s, a) => s + a.preco, 0);
}

export default function CardapioDigital() {
  const [cat, setCat] = useState<CatId>('pizzas');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [aberto, setAberto] = useState<ItemCardapio | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [taxaServico, setTaxaServico] = useState(true);

  const itens = useMemo(() => CARDAPIO.filter((i) => i.cat === cat), [cat]);

  const subtotal = carrinho.reduce((s, c) => s + c.unit * c.qtd, 0);
  const taxa = taxaServico ? subtotal * 0.1 : 0;
  const total = subtotal + taxa;
  const qtdTotal = carrinho.reduce((s, c) => s + c.qtd, 0);

  const adicionar = (item: ItemCarrinho) => setCarrinho((p) => [...p, item]);
  const mudarQtd = (u: string, d: number) =>
    setCarrinho((p) =>
      p.map((c) => (c.uid === u ? { ...c, qtd: Math.max(1, c.qtd + d) } : c)),
    );
  const remover = (u: string) => setCarrinho((p) => p.filter((c) => c.uid !== u));

  return (
    <div className="flex flex-col h-full bg-[#0C0D10]">
      {/* Cabeçalho estilo cliente */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#01B8FA]/12 border border-[#01B8FA]/30 flex items-center justify-center">
            <QrCode className="h-4 w-4 text-[#01B8FA]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#F7F8FA] leading-tight">Cardápio Digital</h1>
            <p className="text-[11px] text-[#8A90A0]">Prévia do que o cliente vê ao ler o QR — Mesa 7</p>
          </div>
        </div>
        <button
          onClick={() => setVerCarrinho(true)}
          className="relative flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors"
        >
          <ShoppingBag className="h-4 w-4" /> Carrinho
          {qtdTotal > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-[#062B38] text-white text-[10px] font-bold flex items-center justify-center">
              {qtdTotal}
            </span>
          )}
        </button>
      </div>

      {/* Categorias */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-2 shrink-0 flex gap-1.5 overflow-x-auto">
        {CATEGORIAS.map((c) => {
          const Icon = c.icon;
          const ativo = cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${
                ativo
                  ? 'bg-[#01B8FA]/[0.14] border-[#01B8FA]/40 text-[#01B8FA]'
                  : 'bg-[#101216] border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/30'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {c.label}
            </button>
          );
        })}
      </div>

      {/* Grade de itens */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-w-[1200px] mx-auto">
          {itens.map((i) => (
            <button
              key={i.id}
              onClick={() => setAberto(i)}
              className="text-left rounded-2xl border border-[#23262F] bg-[#101216] p-4 hover:border-[#01B8FA]/40 hover:shadow-md transition-all flex gap-3"
            >
              <div className="h-14 w-14 rounded-xl bg-[#0C0D10] flex items-center justify-center text-3xl shrink-0">
                {i.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[#F7F8FA] truncate">{i.nome}</h3>
                  {i.meioAMeio && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#01B8FA]/12 text-[#01B8FA] shrink-0">½+½</span>
                  )}
                </div>
                <p className="text-[11px] text-[#8A90A0] leading-snug mt-0.5 line-clamp-2">{i.descricao}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-black text-[#F7F8FA]">{brl(i.preco)}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#01B8FA]">
                    Personalizar <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {aberto && (
        <ModalItem
          item={aberto}
          onFechar={() => setAberto(null)}
          onAdicionar={(c) => { adicionar(c); setAberto(null); }}
        />
      )}

      {verCarrinho && (
        <Carrinho
          itens={carrinho}
          subtotal={subtotal}
          taxa={taxa}
          total={total}
          taxaServico={taxaServico}
          onTaxa={setTaxaServico}
          onQtd={mudarQtd}
          onRemover={remover}
          onFechar={() => setVerCarrinho(false)}
        />
      )}
    </div>
  );
}

function ModalItem({
  item, onFechar, onAdicionar,
}: {
  item: ItemCardapio;
  onFechar: () => void;
  onAdicionar: (c: ItemCarrinho) => void;
}) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [adic, setAdic] = useState<Adicional[]>([]);
  const [segundo, setSegundo] = useState<ItemCardapio | undefined>(undefined);

  const outrasPizzas = CARDAPIO.filter((p) => p.cat === 'pizzas' && p.id !== item.id);
  const unit = precoUnit(item, segundo, adic);

  const toggleAdic = (a: Adicional) =>
    setAdic((p) => (p.some((x) => x.id === a.id) ? p.filter((x) => x.id !== a.id) : [...p, a]));

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onFechar} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#101216] z-50 shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#23262F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{item.emoji}</span>
            <div>
              <h2 className="text-lg font-black text-[#F7F8FA] leading-tight">{item.nome}</h2>
              <p className="text-[11px] text-[#8A90A0]">{item.descricao}</p>
            </div>
          </div>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg hover:bg-[#0C0D10] flex items-center justify-center text-[#8A90A0] shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Meio a meio */}
          {item.meioAMeio && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">
                Segundo sabor (meio a meio)
              </h3>
              <p className="text-[11px] text-[#8A90A0] mb-2">Opcional — cobramos o sabor mais caro.</p>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  onClick={() => setSegundo(undefined)}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg border transition-all ${
                    !segundo ? 'border-[#01B8FA] bg-[#01B8FA]/[0.06] text-[#F7F8FA] font-semibold' : 'border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40'
                  }`}
                >
                  Inteira ({item.nome})
                  {!segundo && <Check className="h-4 w-4 text-[#01B8FA]" />}
                </button>
                {outrasPizzas.map((p) => {
                  const sel = segundo?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSegundo(p)}
                      className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg border transition-all ${
                        sel ? 'border-[#01B8FA] bg-[#01B8FA]/[0.06] text-[#F7F8FA] font-semibold' : 'border-[#23262F] text-[#8A90A0] hover:border-[#01B8FA]/40'
                      }`}
                    >
                      <span>½ {p.nome}</span>
                      <span className="flex items-center gap-2 text-[11px] text-[#8A90A0]">
                        {brl(p.preco)} {sel && <Check className="h-4 w-4 text-[#01B8FA]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Adicionais */}
          {item.adicionais && item.adicionais.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">Adicionais</h3>
              <div className="space-y-1.5">
                {item.adicionais.map((a) => {
                  const sel = adic.some((x) => x.id === a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAdic(a)}
                      className={`w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg border transition-all ${
                        sel ? 'border-[#01B8FA] bg-[#01B8FA]/[0.06]' : 'border-[#23262F] hover:border-[#01B8FA]/40'
                      }`}
                    >
                      <span className={`flex items-center gap-2 ${sel ? 'text-[#F7F8FA] font-semibold' : 'text-[#8A90A0]'}`}>
                        <span className={`h-4 w-4 rounded border flex items-center justify-center ${sel ? 'bg-[#01B8FA] border-[#01B8FA]' : 'border-[#5E6472]'}`}>
                          {sel && <Check className="h-3 w-3 text-white" />}
                        </span>
                        {a.nome}
                      </span>
                      <span className="text-[11px] font-bold text-[#01B8FA]">+ {brl(a.preco)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#8A90A0] mb-2">Observação</h3>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: sem cebola, ponto da carne, etc."
              rows={2}
              className="w-full text-sm rounded-lg px-3 py-2 text-[#F7F8FA] bg-[#0C0D10] border border-[#23262F] focus:outline-none focus:border-[#01B8FA]/50 resize-none"
            />
          </div>
        </div>

        {/* Rodapé: quantidade + adicionar */}
        <div className="px-5 py-4 border-t border-[#23262F] flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#23262F] px-1">
            <button onClick={() => setQtd((q) => Math.max(1, q - 1))} className="h-8 w-8 flex items-center justify-center text-[#8A90A0] hover:text-[#F7F8FA]">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-bold text-[#F7F8FA]">{qtd}</span>
            <button onClick={() => setQtd((q) => q + 1)} className="h-8 w-8 flex items-center justify-center text-[#8A90A0] hover:text-[#F7F8FA]">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => onAdicionar({ uid: uid(), base: item, qtd, segundoSabor: segundo, adicionais: adic, obs, unit })}
            className="flex-1 flex items-center justify-between text-sm font-bold px-4 py-2.5 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors"
          >
            <span>Adicionar</span>
            <span>{brl(unit * qtd)}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Carrinho({
  itens, subtotal, taxa, total, taxaServico, onTaxa, onQtd, onRemover, onFechar,
}: {
  itens: ItemCarrinho[];
  subtotal: number;
  taxa: number;
  total: number;
  taxaServico: boolean;
  onTaxa: (v: boolean) => void;
  onQtd: (u: string, d: number) => void;
  onRemover: (u: string) => void;
  onFechar: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onFechar} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#101216] z-50 shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-[#23262F] flex items-center justify-between">
          <h2 className="text-lg font-black text-[#F7F8FA] flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#01B8FA]" /> Seu pedido
          </h2>
          <button onClick={onFechar} className="h-8 w-8 rounded-lg hover:bg-[#0C0D10] flex items-center justify-center text-[#8A90A0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {itens.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <ShoppingBag className="h-10 w-10 text-[#5E6472]" />
              <p className="text-sm text-[#8A90A0] mt-3">Seu carrinho está vazio.</p>
            </div>
          )}
          {itens.map((c) => (
            <div key={c.uid} className="rounded-xl border border-[#23262F] bg-[#101216] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[#F7F8FA] text-sm">
                    {c.segundoSabor ? `½ ${c.base.nome} + ½ ${c.segundoSabor.nome}` : c.base.nome}
                  </p>
                  {c.adicionais.length > 0 && (
                    <p className="text-[11px] text-[#8A90A0]">+ {c.adicionais.map((a) => a.nome).join(', ')}</p>
                  )}
                  {c.obs && <p className="text-[11px] text-[#FF6B7A]">↳ {c.obs}</p>}
                </div>
                <button onClick={() => onRemover(c.uid)} className="text-[#5E6472] hover:text-[#FF6B7A] shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-[#23262F] px-1">
                  <button onClick={() => onQtd(c.uid, -1)} className="h-7 w-7 flex items-center justify-center text-[#8A90A0]"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-sm font-bold text-[#F7F8FA]">{c.qtd}</span>
                  <button onClick={() => onQtd(c.uid, 1)} className="h-7 w-7 flex items-center justify-center text-[#8A90A0]"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <span className="font-black text-[#F7F8FA]">{brl(c.unit * c.qtd)}</span>
              </div>
            </div>
          ))}
        </div>

        {itens.length > 0 && (
          <div className="border-t border-[#23262F] px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-[#8A90A0]">
              <span>Subtotal</span><span>{brl(subtotal)}</span>
            </div>
            <button
              onClick={() => onTaxa(!taxaServico)}
              className="w-full flex items-center justify-between text-sm text-[#8A90A0]"
            >
              <span className="flex items-center gap-2">
                <span className={`h-4 w-4 rounded border flex items-center justify-center ${taxaServico ? 'bg-[#01B8FA] border-[#01B8FA]' : 'border-[#5E6472]'}`}>
                  {taxaServico && <Check className="h-3 w-3 text-white" />}
                </span>
                Taxa de serviço (10%)
              </span>
              <span>{brl(taxa)}</span>
            </button>
            <div className="flex items-center justify-between text-lg font-black text-[#F7F8FA] pt-2 border-t border-[#23262F]">
              <span>Total</span><span>{brl(total)}</span>
            </div>
            <button className="w-full mt-2 text-sm font-bold px-4 py-3 rounded-xl bg-[#01B8FA] hover:bg-[#3DC8FB] text-[#062B38] transition-colors">
              Enviar pedido para a cozinha
            </button>
            <p className="text-center text-[10px] text-[#8A90A0]">
              Prévia — no ar, o pedido cai na comanda da mesa e no painel da cozinha.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
