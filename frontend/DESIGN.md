# Guia de Design — Tema Escuro "Lumin" (app.luminmkt.shop)

> Referência única de estilo para o frontend. Baseado no **Dashboard**
> (`src/pages/DashboardPage.tsx` + `.theme-site` em `src/index.css`) e na tela de
> **Produtos** (`src/modules/cadastros/`). O objetivo é que **toda tela nova ou
> migrada fique idêntica** a essas duas. Se um valor não estiver aqui, copie do
> Dashboard — ele é a fonte da verdade.

---

## 1. Princípios

1. **Fundo quase-preto** `#08090A`, superfícies em cinza-azulado muito escuro.
2. **Um único accent: ciano-azul `#01B8FA`.** Nada de azul-royal antigo, nada de
   âmbar/ouro como accent. Âmbar só como cor **semântica** (aviso/pendente).
3. **Números em branco, mono.** Todo valor (R$, kg, %, contadores) usa
   `JetBrains Mono` branco `#F7F8FA`/`#FFFFFF`. O número é o herói da tela.
4. **Minimal.** Hairlines de 1px, brilhos sutis, muito respiro escuro, pouca
   cor. Cor entra só para dar significado (status, aging, deltas).
5. **Texto sobre o accent é ESCURO** (`#04121A`), nunca branco — o ciano é claro.

---

## 2. Tokens de cor

Definidos como variáveis CSS em `.theme-site` (`index.css`). Nas telas de módulo
(que **não** têm `.theme-site`) usa-se o **hex cru** equivalente — a coluna
"Hardcoded" é o que você escreve no Tailwind (`bg-[#101216]`, `text-[#8A90A0]`…).

| Papel | Token | Hex (Hardcoded) | Uso |
|---|---|---|---|
| Fundo da página | `--s-bg` | `#08090A` | canvas atrás de tudo, header |
| Superfície | `--s-surface` | `#101216` | cards, tabelas, inputs, modal |
| Superfície 2 | `--s-surface-2` | `#0C0D10` | barra de filtros, header de tabela, hover, painéis internos |
| Superfície elevada | `--s-surface-hi` | `#16181F` | KPIs, chips escuros, tooltip de gráfico |
| Linha (borda visível) | `--s-line` | `#23262F` | todas as bordas/divisórias 1px |
| Linha sutil | `--s-line-soft` | `#191B21` | hairline interno, borda do header |
| Tinta principal | `--s-ink` | `#F7F8FA` | texto/título padrão |
| Tinta forte | `--s-ink-bright` | `#FFFFFF` | números-manchete, títulos |
| Texto secundário | `--s-mut` | `#8A90A0` | subtítulos, labels, muted |
| Texto terciário | `--s-mut-2` | `#5E6472` | eixos de gráfico, dicas, "estável" |
| **Accent** | `--s-accent` | `#01B8FA` | ações, foco, linhas de gráfico, ícones ativos |
| Accent 2 (hover/escuro) | `--s-accent-2` | `#0E86D4` | texto sobre chip-accent claro, hover |
| Accent soft | `--s-accent-soft` | `rgba(1,184,250,0.12)` | fundo de chip/botão selecionado |
| Texto sobre accent | — | `#04121A` | **sempre** o texto de botão ciano |

**Cores categóricas / semânticas** (leitura por cor — status, aging, deltas):

| Nome | Token | Hex | Significado |
|---|---|---|---|
| Ciano | `--s-cyan` | `#22D3EE` | hover do accent, faixa aging 8–30 |
| Azul | `--s-blue` | `#3B9EFF` | categórico / +30 dias |
| Violeta | `--s-violet` | `#A78BFA` | categórico / faturado |
| Verde | `--s-green` | `#2DD4A7` | sucesso, ativo, positivo (delta ↑ usa `#34D9A6`) |
| Rosa | `--s-rose` | `#FF6B7A` | erro, vencido, negativo, inativo/bloqueado |
| Laranja | `--s-orange` | `#FF9F45` | aviso, pendente, validade |

> **Regra de opacidade dos fundos coloridos:** chip/badge semântico usa a cor a
> **/12** de fundo e a cor cheia no texto. Ex.: `bg-[#2DD4A7]/12 text-[#2DD4A7]`.

---

## 3. Tipografia

| Família | Onde | Peso/estilo |
|---|---|---|
| **Bricolage Grotesque** | `h1–h4`, títulos, headline | 700, `tracking-[-0.02em]`, cor `#FFFFFF` |
| **Inter Tight** | corpo, labels, textos | 400–600 |
| **JetBrains Mono** | **todos os números**, código, eyebrow | `tabular-nums`, `tracking-[-0.01em]` |

Tamanhos de referência:

- Título do header de página: **15px** bold (`text-[15px]`), dashboard usa 19px.
- Número-manchete (headline sobre gráfico): **30px** bold mono (`.headline`).
- Valor de KPI: **23px** bold branco (`.kpi-value`).
- Eyebrow (rótulo mono maiúsculo): **11.5px**, `tracking-[0.08em]`, uppercase,
  cor accent (`.eyebrow`) ou `#5E6472` (`.eyebrow.mut`).
- Corpo de tabela: **12px** (`text-[12px]`). Ver §8.

---

## 4. Dois jeitos de aplicar o tema

O app tem duas zonas — escreva o CSS conforme onde a tela mora:

1. **Dashboard e telas com `.theme-site`** → use as classes utilitárias do tema
   (`.kpi`, `.panelx`, `.eyebrow`, `.headline`, `.pill`, `.seg`, `.btn-accent`,
   `.track`, `.dash-head`, `.head-badge`). Elas puxam as variáveis `--s-*`.
2. **Telas de módulo** (`src/modules/**`, sem `.theme-site`) → use o **kit
   `cadastros/ui.tsx`** (`TopBar`, `PageHeader`, `FilterBar`, `Chips`, `SearchField`,
   `TableCard`, `Th`, `StatusBadge`, `Modal`, `SteppedForm`, `FAB`, `inp`, `lbl`,
   `btnPrimary`, `btnGlass`) — ele replica o visual do Dashboard com **hex cru**
   inline. É por isso que o kit é a espinha dorsal: mexeu nele, mudou 27 telas.

**Nunca** dependa do cascade do `.theme-site` numa tela de módulo — ele não está
lá. Se precisar de um estilo do tema numa tela de módulo, escreva o hex.

---

## 5. Estrutura de página (módulo)

```tsx
<CadastroShell>                        {/* flex flex-col h-full text-[#F7F8FA] */}
  <TopBar icon={<Icon/>} titulo="…" subtitulo="…" onNovo={…} />   {/* §6 + FAB §14 */}
  <FilterBar busca={q} onBusca={setQ} placeholder="…">           {/* §7 */}
    <Chips … />
  </FilterBar>
  <div className="flex-1 overflow-auto p-4">                       {/* área de conteúdo */}
    {loading ? <Loader/> : vazio ? <Vazio/> : <TableCard>…</TableCard>}  {/* §8, §16 */}
  </div>
  {modal && <Modal>…</Modal>}                                     {/* §13 */}
</CadastroShell>
```

Ordem fixa: **header → barra de filtros → conteúdo rolável**. Padding do conteúdo
`p-4`. O header e a barra de filtros são `shrink-0`; só o conteúdo rola.

---

## 6. Header de página

Mesma linguagem do `.dash-head`. No kit é o componente interno `HeaderBar`
(usado por `TopBar` e `PageHeader`). Anatomia:

- **Container:** `relative flex items-center justify-between gap-3 shrink-0
  border-b border-[#191B21] px-4 py-2.5 sm:px-5` com fundo
  `radial-gradient(140% 120% at 0% -20%, rgba(1,184,250,0.07), rgba(1,184,250,0) 42%), #08090A`.
- **Filete de accent na base:** `<span>` absoluto `bottom-[-1px] h-px
  bg-gradient-to-r from-[#01B8FA]/35 to-transparent`.
- **Badge do ícone (chip):** `grid h-[34px] w-[34px] place-items-center
  rounded-[10px] border border-[#01B8FA]/30 text-[#01B8FA]`, fundo
  `radial-gradient(120% 120% at 30% 20%, rgba(1,184,250,0.22), rgba(1,184,250,0.06))`,
  sombra `0 0 18px -6px rgba(1,184,250,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`.
  Ícone `lucide` 18–20px.
- **Título:** `text-[15px] font-bold leading-none tracking-tight text-[#F7F8FA]`.
- **Subtítulo:** `text-[11px] text-[#8A90A0]` (some no mobile: `hidden sm:block`).
- **Ações à direita** (opcional): `flex items-center gap-2`.

> O ícone do header deve **fazer sentido** para a tela (Produtos = `Package`,
> Clientes = `Users`…). Nunca um ícone decorativo aleatório.

---

## 7. Barra de filtros (busca + chips)

- **Container `FilterBar`:** `shrink-0 border-b border-[#23262F] bg-[#0C0D10]
  px-4 py-2.5 sm:px-5`, layout `flex-col gap-2.5 sm:flex-row sm:items-center`.
- **`SearchField`:** pílula. `h-10 rounded-full border border-[#23262F]
  bg-[#101216] pl-10 pr-10 text-[13px] text-[#F7F8FA]
  placeholder:text-[#8A90A0]`, foco `focus:border-[#01B8FA]/60
  focus:ring-4 focus:ring-[#01B8FA]/10`. Ícone `Search` à esquerda
  `text-[#8A90A0]` → `group-focus-within:text-[#01B8FA]`. Botão limpar (X)
  aparece com texto: hover `hover:bg-[#23262F] hover:text-[#F7F8FA]`.
- **`Chips` (filtro rápido):** botão `px-3 py-1.5 rounded-lg text-xs font-semibold
  border`. Selecionado: `bg-[#01B8FA]/12 border-[#01B8FA]/45 text-[#0E86D4]`.
  Normal: `bg-[#101216] border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA]
  hover:bg-[#0C0D10]`.
  **Os chips devem refletir dados reais** — derive as opções do dataset
  (`Array.from(new Set(...))`), não de uma lista fixa desatualizada.

---

## 8. Tabelas — **especificação compacta canônica**

Densidade é regra: fonte pequena, linhas baixas, hairlines. Referência exata
(kit `TableCard`/`Th`):

- **Wrapper `TableCard`:** `bg-[#101216] rounded-2xl border border-[#23262F]
  overflow-hidden`, sombra sutil. `<table className="w-full text-[12px]">`.
- **Cabeçalho `Th`:** `px-3 py-1.5 text-left font-semibold text-[#8A90A0]
  text-[10px] uppercase tracking-[0.08em] bg-[#0C0D10] border-b border-[#23262F]`.
  Fundo do header é **escuro** (`#0C0D10`), nunca claro.
- **Linha `<tr>`:** `border-t border-[#23262F] hover:bg-white/[0.03]`.
- **Célula `<td>`:** `px-3 py-1` (padding vertical curto = linhas baixas).
- **Célula-título (nome):** primária + secundária empilhadas:
  ```tsx
  <p className="font-semibold text-[12.5px] leading-tight text-[#F7F8FA] truncate max-w-[240px]">{nome}</p>
  <p className="text-slate-500 text-[10.5px] font-mono leading-tight">{codigo}</p>
  ```
- **Valores numéricos:** mono. Dinheiro/estoque em `text-[#8A90A0]` (ou branco
  `#F7F8FA` quando é o número-herói da linha); nunca cinza apagado demais
  (`#5B5D69`/`#5E6472` só para dado secundário).
- **Sem avatares/emoji decorativos por linha.** A tabela é dado, não ilustração.

### 8.1 Pílulas dentro da tabela (categoria, tipo)

Chip **escuro neutro**, nunca creme/branco:
`px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16181F] border border-[#23262F] text-[#8A90A0]`.
Quando a pílula tem significado, use a cor semântica a /12
(ex.: `bg-[#01B8FA]/12 text-[#0E86D4]`).

### 8.2 `StatusBadge`

`px-2 py-0.5 rounded-full text-[10px] font-bold`. Ativo:
`bg-[#2DD4A7]/12 text-[#2DD4A7]`. Inativo/bloqueado: `bg-[#FF6B7A]/12 text-[#FF6B7A]`.

### 8.3 Ações de linha

- Botão "Editar" outline-accent: `text-[11px] bg-[#01B8FA]/12 text-[#0E86D4]
  border border-[#01B8FA]/30 px-2 py-1 rounded font-semibold hover:bg-[#01B8FA]/20`.
- Ícone destrutivo: `text-slate-500 hover:text-[#FF6B7A]`.

---

## 9. KPIs e painéis

### 9.1 KPI card (`.kpi`)

Placa **elevada** `#16181F` com brilho no canto e filete de cor no topo:
- `padding: 15px 16px 16px; border-radius: 16px; border: 1px solid #23262F`,
  fundo `radial-gradient(130% 110% at 0% 0%, rgba(255,255,255,0.045), transparent 52%), #16181F`,
  sombra `inset 0 1px 0 rgba(255,255,255,0.035), 0 22px 44px -38px rgba(0,0,0,0.9)`.
- **Chip do ícone (`.kpi-chip`):** 34×34, `rounded-[10px]`, cor/soft/line derivados
  do tom (`fg`, `fg` a 1f, `fg` a 45). Ex. accent: fg `#01B8FA`.
- **Label:** eyebrow 10.5px muted. **Valor:** 23px bold branco mono. **Sub:** 11px muted.
- Interativo: hover `translateY(-2px)` + borda tende ao tom + seta `>` aparece.

Tons disponíveis (chip): `accent #01B8FA`, `cyan #22D3EE`, `blue #3B9EFF`,
`violet #A78BFA`, `green #2DD4A7`, `rose #FF6B7A`, `amber #FF9F45`, `slate #8A90A0`.

### 9.2 Painel de conteúdo (`.panelx`)

Card grande de gráfico/lista: `border-radius: 18px; padding: 20px; background:
#101216; border: 1px solid #23262F; box-shadow: 0 30px 66px -52px rgba(0,0,0,0.9)`.
Topo do painel: eyebrow + **headline** (número 30px mono branco) + `Delta`.
Canto direito: `.pill` (mono, borda ciano `rgba(1,184,250,0.4)`, `rounded-full`).

### 9.3 Delta (variação)

`inline-flex items-center gap-0.5 text-[11px] font-semibold`. ↑ positivo
`text-[#34D9A6]` com `ArrowUpRight`; ↓ negativo `text-[#FF6B7A]` com
`ArrowDownRight`; zero: `text-[#5E6472]` "estável".

---

## 10. Gráficos (Recharts) — padrão do Dashboard

**Tooltip escuro reutilizável** (constante `tipStyle`):
```js
{ background: '#16181F', border: '1px solid #23262F', borderRadius: 10,
  fontSize: 12, color: '#F7F8FA', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }
```

**Área/linha (série temporal):**
- Gradiente de preenchimento: `#01B8FA` de `0.42` → `0.12` → `0` (top→bottom).
- `CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.055)" vertical={false}`.
- Eixos: `tick={{ fill: '#5E6472', fontSize: 10 }}`, `axisLine={false}`,
  `tickLine={false}`. `YAxis` formata valores curtos (R$ mil/mi).
- Linha: `stroke="#01B8FA" strokeWidth={2.5}` `dot={false}`,
  `activeDot={{ r: 4, fill: '#01B8FA', stroke: '#08090A', strokeWidth: 2 }}`.
- `cursor={{ stroke: 'rgba(1,184,250,0.45)', strokeWidth: 1, strokeDasharray: '4 4' }}`.

**Barras (categórico):**
- `Bar radius={[0,5,5,0]}` (horizontal) e uma `<Cell>` por item com a **cor
  categórica** correspondente ao status.
- `cursor={{ fill: 'rgba(255,255,255,0.04)' }}`. Eixo de categoria
  `tick={{ fill: '#8A90A0', fontSize: 11 }}`.

**Barras de progresso / aging (sem Recharts):**
- Trilha: `.track` = `background: rgba(255,255,255,0.07)`, `h-2.5 rounded-full
  overflow-hidden` (aging) ou `h-1.5` (ranking).
- Preenchimento: segmentos com a cor da faixa (vencido `#FF6B7A`, 0–7 `#01B8FA`,
  8–30 `#22D3EE`, +30 `#3B9EFF`) ou gradiente accent
  `bg-gradient-to-r from-[#0E86D4] to-[#01B8FA]`.

> **Nunca** deixe eixo/grid de gráfico em cor clara. Grid = branco a ~5%, eixo =
> `#5E6472`, texto do tooltip branco sobre `#16181F`.

---

## 11. Botões

| Tipo | Classe/estilo | Uso |
|---|---|---|
| **Primário (accent)** | `bg-[#01B8FA] hover:bg-[#22D3EE] text-[#04121A] font-bold rounded-lg` (kit `btnPrimary`) / `.btn-accent` | ação principal, salvar |
| **Fantasma/glass** | `bg-[#101216] border border-[#23262F] text-[#8A90A0] hover:text-[#F7F8FA] hover:bg-[#0C0D10]` (kit `btnGlass`) / `.btn-ghost` | ação secundária, cancelar |
| **Segmented (`.seg`)** | trilho `#0C0D10` borda `#23262F`; botão on = `bg-[rgba(1,184,250,0.16)] text-[#01B8FA]` | seletor período/ordem |

Regras: texto de botão accent é **sempre `#04121A`** (nunca branco). Sombra de
botão accent usa o ciano (`rgba(1,184,250,0.28)`), **nunca** o azul antigo
`rgba(47,95,224,…)`. `active:scale-[0.98]`, `transition-all duration-300`.

---

## 12. FAB "Novo" + gatilho da Lu

Os dois moram no canto inferior-direito e **não podem se sobrepor**:

- **Lu (assistente):** `fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[60]`,
  `h-11 w-11 rounded-full border border-white/10 bg-[#101216]/90 text-[#8A90A0]`,
  ícone `Sparkles`. Hover ganha borda/텍스트 ciano.
- **FAB "Novo" (kit):** fica **acima** da Lu — `fixed bottom-24 right-5 sm:right-6
  z-[55]`, pílula que expande no hover: `h-11 rounded-full bg-[#01B8FA]
  text-[#04121A] border border-[#22D3EE]/40 shadow-[0_10px_28px_rgba(1,184,250,0.32)]`,
  ícone `Plus`. Sem glow azul antigo.

---

## 13. Inputs, formulários e modais

- **Input padrão (`inp`):** `w-full bg-[#101216] border border-[#23262F]
  rounded-lg px-3 py-2 text-sm text-[#F7F8FA] placeholder:text-[#8A90A0]
  focus:border-[#01B8FA]/60 focus:ring-2 focus:ring-[#01B8FA]/20`.
  Inputs de **data**: adicionar `[color-scheme:dark]` para o date-picker escuro.
- **Label (`lbl`):** `text-[10px] font-semibold text-[#8A90A0] uppercase
  tracking-[0.1em]`.
- **Modal:** backdrop **escuro** `bg-black/70 backdrop-blur-sm` (nunca claro).
  Caixa `bg-[#101216] border border-[#23262F] rounded-2xl`, faixa de brilho
  ciano no topo, header/rodapé fixos com `border-[#23262F]`. Botão salvar =
  `btnPrimary` (texto `#04121A`).
- **SteppedForm:** barra de progresso segmentada (trilha `#23262F`, preenchida
  `from-[#01B8FA] to-[#22D3EE]`); topo sticky com gradiente da **cor do modal**
  (`from-[#101216]`), nunca branco. Passo concluído = check verde
  `bg-[#2DD4A7]/15 text-[#2DD4A7]`.
- **Erro de formulário:** `bg-rose-500/10 text-[#FF6B7A] px-3 py-2 rounded-lg`
  (nunca `bg-rose-50/text-rose-700` claro).

---

## 14. Estados

- **Loader (skeleton):** placa `bg-[#101216] border border-[#23262F]`, linhas
  `skeleton` com divisórias `#23262F`.
- **Vazio (`Vazio`):** ícone `lucide` grande a `opacity-40` centralizado + texto
  `text-[#8A90A0] text-sm`. Ex.: `<Vazio icon={<Package/>} texto="Nenhum … encontrado"/>`.

---

## 15. Do & Don't (armadilhas comuns)

**NÃO:**
- ❌ `bg-white` / `bg-[#F…]` / cinzas claros (`#F3F4F6`, `#F0EEE9`, `#EEF0F2`) —
  são resíduos do tema claro. Fundo de header de tabela, pílula e placa **sempre
  escuros**.
- ❌ Texto branco sobre botão ciano → use `#04121A`.
- ❌ Sombra/`ring`/glow azul antigo `rgba(47,95,224,…)` → use ciano.
- ❌ Emoji/avatar decorativo por linha numa tabela de dados.
- ❌ `text-[#16171D]`/`#202123` como **texto** (some no escuro). `#16171D` só é
  válido como **fundo** de backdrop (`bg-[#16171D]/40`).
- ❌ Eixo/grid de gráfico claro; date-input sem `[color-scheme:dark]`.
- ❌ Chips de filtro fixos que não batem com os dados.

**SIM:**
- ✅ Fundo `#08090A`, superfícies `#101216`/`#0C0D10`/`#16181F`, linhas `#23262F`.
- ✅ Números em mono branco.
- ✅ Accent ciano `#01B8FA` para ação/foco/gráfico; semânticos (verde/rosa/laranja)
  só com significado, sempre a /12 de fundo.
- ✅ Tabela compacta: `text-[12px]`, `td px-3 py-1`, nome `text-[12.5px]`.

---

## 16. Codemod (migração assistida)

`scripts/theme-migrate.mjs` remapeia hex claros → escuros por pasta:

```bash
node scripts/theme-migrate.mjs --dry src/modules/<modulo>   # prévia (não grava)
node scripts/theme-migrate.mjs       src/modules/<modulo>   # aplica
```

Depois de rodar, **revise a tela**: o codemod não pega tudo (pílulas creme
class-qualified novas, texto claro sobre ciano, eixos de gráfico, `color-scheme`
de inputs de data, cores nomeadas do Tailwind). Use este guia para o polimento
fino e mantenha o kit `ui.tsx` como referência.
