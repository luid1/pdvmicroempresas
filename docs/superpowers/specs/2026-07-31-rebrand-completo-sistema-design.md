# Rebrand completo do sistema Lumin PDV — Design

**Data:** 2026-07-31
**Escopo:** Sistema interno (React, `frontend/`) — pós-login. Site de marketing e tela de login já estão em âmbar e ficam como estão.
**Objetivo:** Unificar o sistema interno à identidade do site (navy + âmbar), padronizar tudo (tamanhos, fontes, botões, gráficos) e deixar com cara de sistema de gestão empresarial (ERP) coeso. Corrigir a estrutura de menu/submenu.

---

## 1. Decisões travadas

- **Âmbar é a marca única.** Site, login e sistema — tudo âmbar. Não há verde de marca (verde só como cor semântica de sucesso).
- **Cores como tokens (variáveis).** Âmbar por padrão, mas a arquitetura permite trocar tema depois (azul, branco/neutro, dark) nas Configurações — sem custo extra agora.
- **Rebrand feito aba por aba** (incremental), começando pelo Dashboard. Cada aba é aprovada antes de seguir.
- **Regra de ouro:** nenhuma aba inventa peça visual própria. Tudo sai dos tokens + do kit de componentes. Se faltar peça, adiciona-se ao kit.
- **Nenhuma rota/tela existente é removida.** A reorganização do menu não apaga nada.
- **Não mexer na lógica do checkout Mercado Pago** (não faz parte deste escopo, mas fica registrado).

---

## 2. Fundações (tokens)

Herdadas do site para "conversarem".

### Cores (iguais às do site)
- Canvas/fundo: navy `--ink #0B0F2B` (hoje o sistema é `#0B0F17` — muda para navy)
- Painéis/cards: `--panel #151A3D`, `--panel-2 #1C2250`
- Bordas/linhas: `--line #2A3068`
- Acento (marca): âmbar `--lumin #FFC24B`, com `--lumin-deep #C98A22` para hover/gradiente
- Texto: `--text #E9EAF5`; secundário: `--muted #8E93BC`
- **Semânticos preservados:** verde = sucesso, vermelho = erro, âmbar = atenção/marca. (Os papéis não mudam.)

### Tipografia (alinhada ao site)
- Display/títulos: **Bricolage Grotesque** (hoje Space Grotesk)
- Corpo/UI: **Inter Tight** (hoje Inter)
- Números/mono (preços, códigos): **JetBrains Mono** (hoje IBM Plex Mono)
- Logo (só a logo): **Comfortaa Bold**
- Escala de tamanho fixa (type scale): 12 / 13 / 14 / 16 / 20 / 24 / 32. Toda aba usa a mesma escala — sem tamanhos avulsos.

### Forma e espaçamento (padrão único)
- Raio: cards **18px** (igual ao site), controles (botões/inputs) **12px**
- Escala de espaçamento fixa: 4 / 8 / 12 / 16 / 24 / 32 — todo padding/gap sai dessa régua
- Uma sombra padrão de card + uma de "elevado" (hover)

---

## 3. Kit de componentes padrão

Todas as telas usam estas peças. Nenhuma tela inventa estilo solto.

**Ações e formulário**
- `.btn-primary` (âmbar cheio), `.btn-ghost` (contorno/translúcido), `.btn-danger` (vermelho, destrutivo) — tamanhos `sm` (32px) / `md` (40px, padrão) / `lg` (48px), forma única
- `.input` / select / textarea — altura `md` (40px), foco com anel âmbar, estado de erro em vermelho, label e ajuda com tamanho fixo
- `.checkbox` / `.radio` / `.switch` (toggle)
- `.searchbar` (busca padrão no topo de listas)
- `.chip` (filtro removível)

**Contêineres e dados**
- `.card` (fundo `--panel`, borda `--line`, raio 18px, sombra) + `.card-header` (título + ação)
- `.kpi` (rótulo muted + número grande em JetBrains Mono + variação verde ↑ / vermelho ↓), todos do mesmo tamanho em grade
- `.table` (cabeçalho, zebra, hover de linha, densidade padrão)
- `.badge` / pill (status usando semânticos)
- `.section` / `.card-grid` / `.divider` (layout)
- `.page-header` (título + subtítulo + ações; igual em toda aba)
- `.breadcrumb`

**Sobreposições e navegação**
- `.modal` / `.dialog` (overlay + header/body/footer)
- `.drawer` (painel lateral deslizante)
- `.tabs` internas (abas dentro de uma tela)
- `.pagination`
- `.tooltip`

**Feedback e estados**
- `.empty-state` (ícone + texto + ação)
- `.skeleton` (carregando)
- `.spinner` (carregando inline)
- `.toast` (notificação flutuante)
- `.alert` / `.banner` (aviso fixo)

**Gráficos**
- Paleta única: âmbar como cor principal + tons de apoio (navy/muted) + verde/vermelho só para semânticos. Grid e labels padronizados. Todo gráfico do sistema usa a mesma paleta.

---

## 4. A casca (AppShell)

### Logo (substitui o carrinho `ShoppingCart`)
- Wordmark em texto, fonte **Comfortaa Bold**, cor âmbar.
- Sidebar expandida: "**Lumin**" por extenso.
- Sidebar recolhida: só o "**L**".
- Transição Lumin ⇄ L acompanha abrir/fechar da barra.

### Interação de abrir/fechar
- Sidebar tem dois estados: **recolhida** (só ícones + "L") e **expandida** (ícones + texto + "Lumin").
- No topo fica a logo. Ao **passar o mouse na logo**, ela vira um **botão de seta** (abrir/fechar). Tirou o mouse, **volta a ser a logo**.
- Clique alterna o estado; o estado fica **salvo** (lembra na próxima visita).

### Header
- Padronizado: título/breadcrumb da tela à esquerda; seletor de filial + busca + usuário à direita.
- Ponto "online" continua verde (semântico).

### Menu (submenu recolhido)
- Quando a barra está recolhida e um item de pasta recebe hover, abre um **submenu flutuante** ao lado (não empurra o conteúdo). Mantido como está hoje.

---

## 5. Reestruturação do menu (correção do submenu)

### Problema atual
1. **Itens que são pasta E página ao mesmo tempo.** Ex.: "Gestão Fiscal", "DRE & Relatórios", "Posição de Estoque", "Usuários & Acessos" abrem uma página própria **e** têm submenu no hover.
2. **Filhos duplicados.** Os itens do submenu aparecem também soltos no mesmo grupo (WMS) ou repetidos como `oculto` (Financeiro).

### Regra nova
> Cada item do menu é **OU uma pasta OU uma página**, nunca os dois.
> - **Pasta:** não abre página própria. Ao passar o mouse, o submenu lista as páginas reais de conteúdo.
> - **Página:** abre a tela ao clicar, sem submenu.
> - A página que hoje é "pai" **vira o primeiro item dentro da pasta** — não some, continua clicável, só muda de lugar.

**Garantia:** toda rota/tela existente continua existindo e acessível. A mudança só (1) remove a duplicação e (2) transforma o "pai" em nome-de-pasta, com a página dele indo para dentro como item.

### Mapeamento proposto (nomes de pasta são provisórios, a ajustar)

| Pasta (não vira página) | Páginas reais dentro (todas continuam existindo) |
|---|---|
| **Estoque** | Posição de Estoque, Movimentações, Inventário, Análise Estoque Físico |
| **Fiscal – Emissão** | Emitir Cupom (NFC-e), Matriz Fiscal |
| **Fiscal – Gestão** | Cupons / NF-e Emitidas, Painel de Vendas |
| **Financeiro (DRE)** | DRE & Relatórios, Controladoria, Fluxo de Caixa, Tesouraria, Contas a Receber, Contas a Pagar, Despesas Recorrentes, Plano de Contas |
| **Acessos** (ou "Administração") | Usuários & Acessos, Configurações, Logs de Auditoria |

Fonte única continua sendo `config/telas.ts`. O modelo de dados precisará distinguir "pasta" de "página" (ex.: um item de pasta não tem rota clicável; seus filhos são as rotas). Detalhe técnico fica para o plano de implementação.

---

## 6. Ordem de migração (aba por aba)

1. **Fundações + kit** (tokens no `index.css` + classes de componente) — base para todo o resto.
2. **AppShell** (logo Lumin/L, sidebar hover, header, menu reestruturado).
3. **Dashboard** (primeira aba de conteúdo migrada — referência visual).
4. Demais abas, uma por vez, cada uma aprovada antes da seguinte (ordem a combinar; sugestão: Caixa/PDV → Cadastros → Estoque → Fiscal → Financeiro → Gerencial).

Cada passo: migrar para tokens + kit, remover `sky-*` e estilos avulsos, validar build, e o usuário aprova.

---

## 7. Fora de escopo

- Site de marketing e tela de login (já em âmbar).
- Lógica de checkout Mercado Pago.
- Backend (Render) e banco (Neon).
- Deploy é manual (arrastar `frontend/dist` no Netlify) — sem CI.
