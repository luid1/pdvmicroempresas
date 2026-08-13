# Rebrand do sistema Lumin PDV — Plano de implementação

Baseado em `2026-07-31-rebrand-completo-sistema-design.md`. Execução incremental, aba por aba, com `npm run build` validando cada etapa. Deploy é manual (arrastar `frontend/dist` no Netlify).

## Etapa 0 — Fontes e meta (base)
- `frontend/index.html`: trocar o `<link>` do Google Fonts para carregar **Bricolage Grotesque**, **Inter Tight**, **JetBrains Mono** e **Comfortaa** (bold). Remover Space Grotesk / IBM Plex Mono / Inter antigos.
- Atualizar `<meta name="theme-color">` de `#0b0f17` para o navy `#0B0F2B`.

## Etapa 1 — Tokens + tema central (`index.css`)
- Adicionar bloco `:root` com os tokens do spec (cores navy+âmbar, fontes, raio, sombra, espaçamento).
- Canvas: `body` de `#0b0f17` → `#0B0F2B`. Superfícies remapeadas para navy (`--panel`/`--panel-2`).
- Acento: `.btn-primary` de `sky-600` → âmbar (`--lumin`, texto escuro). `.input` foco de sky → âmbar. Foco global de input (linhas 202-206) sky → âmbar.
- Tipografia: `html` font-family → Inter Tight. `.font-display` → Bricolage Grotesque. `.font-plex-mono` → JetBrains Mono. Nova classe `.font-logo` → Comfortaa Bold.
- Ajustar `.glass`/`.card` para o navy translúcido (mantendo o efeito de vidro, mas na base navy).
- Remapear tints legadas azuis (`.bg-sky-*`, `.bg-blue-*`, `.text-sky-*`, `.text-blue-*`) para âmbar onde for cor de marca (manter azul só se for dado/informativo neutro — decidir caso a caso).

## Etapa 2 — Kit de componentes (`index.css`)
- Criar/ajustar classes: `.btn-primary/.btn-ghost/.btn-danger` (tamanhos sm/md/lg), `.input/.label`, `.card/.card-header`, `.kpi`, `.table/.th/.td`, `.badge`, `.page-header`, `.section/.card-grid/.divider`, `.modal/.dialog`, `.drawer`, `.tabs`, `.pagination`, `.empty-state`, `.skeleton` (já existe), `.spinner`, `.toast`, `.alert/.banner`, `.chip`, `.searchbar`, `.switch`, `.tooltip`.
- Paleta de gráficos: definir variáveis `--chart-1..n` (âmbar principal + apoio).

## Etapa 3 — AppShell (`components/layout/AppShell.tsx`)
- Remover `ShoppingCart` do topo; colocar wordmark **Lumin** (`.font-logo`, âmbar). Recolhida → só **L**.
- Sidebar hover-na-logo: logo vira botão de seta (abrir/fechar); sai o mouse → volta logo. Estado salvo (localStorage).
- Recolorir sky → âmbar (NavLink ativo, indicador, avatar, foco do FilialSelector). Online dot continua verde.
- Header padronizado (breadcrumb/título + filial + busca + usuário).

## Etapa 4 — Menu reestruturado (`config/telas.ts`)
- Introduzir distinção **pasta vs página** no modelo (ex.: item de pasta sem rota clicável; filhos são as rotas). Manter fonte única.
- Aplicar mapeamento do spec: Estoque, Fiscal–Emissão, Fiscal–Gestão, Financeiro (DRE), Acessos. Página-pai vira 1º filho. Remover duplicações e itens `oculto` redundantes.
- Ajustar `AppShell` para renderizar pasta (não clicável, só abre submenu) vs página.

## Etapa 5+ — Migração aba por aba
Ordem sugerida (cada uma aprovada antes da próxima):
1. Dashboard (referência visual)
2. Caixa / PDV
3. Cadastros (Produtos, Preços, Fornecedores, Clientes, Lojas)
4. Estoque / WMS
5. Fiscal
6. Financeiro
7. Gerencial
Cada aba: trocar `sky-*` e estilos avulsos por tokens + kit, validar build, aprovar.

## Validação por etapa
- `cd frontend && npm run build` sem erros.
- Conferência visual da aba migrada.
- Commit por etapa. Deploy manual quando o usuário quiser publicar.
