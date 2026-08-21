# Tela de login — alinhamento com o design do site

> **Atenção: o app e o site são repositórios SEPARADOS.**
>
> - **Site institucional** (`luminmkt.shop`) → projeto **`lumin-site`** (Next.js 14).
>   É de onde veio a referência de design (base escura + azul `#01B8FA`).
> - **App / sistema** (`app.luminmkt.shop`) → projeto **`mercado-pdv-github`**
>   (este repositório — frontend em Vite + React). É onde fica a tela de login.
>
> Mudanças em um repositório **não** aparecem no outro. Cada um tem seu próprio
> `tailwind.config`, seu `index.css`/`globals.css` e seu próprio deploy
> (o site na Vercel; o app no Netlify). Este documento descreve a mudança feita
> **apenas no app**, para deixar a tela de login parecida com o site.

## O que foi feito

A tela de login (`frontend/src/pages/LoginPage.tsx`) usava o tema **claro** do
sistema (fundo porcelana `#F7F7F8` + verde-petróleo `#0F8A72`). Ela foi
reestilizada para o tema do **site**: **base escura + azul `#01B8FA`**, com o
**wordmark "Lumin"** idêntico ao do site (o "i" sem pingo `ı` + um ponto azul
com glow, na fonte Comfortaa).

**Importante:** só mudaram **cores, superfícies e a marca**. Nenhuma lógica de
autenticação, fluxo de telas (PAIR → PICKER → SENHA / DONO), chamadas de API,
`localStorage`, timeouts ou tratamento de erro foi alterada.

### Arquivos tocados (todos no app / `mercado-pdv-github`)

1. **`frontend/src/pages/LoginPage.tsx`**
   - Container raiz: fundo claro → `bg-[#08090A]` (escuro) + classe `login-dark`
     + uma "aura" azul radial sutil ao fundo (igual ao hero do site).
   - Banner lateral: fundo `#0B0C0E`, acentos verdes → azul `#01B8FA` / `#3DC8FB`.
   - Componente `Brand`: trocado o "quadradinho verde + Store" pelo **wordmark
     "Lumin"** com o ponto azul (fonte `.font-logo` = Comfortaa).
   - Cards/painéis: branco → `bg-[#111214] border-white/10`.
   - Inputs: branco → `bg-[#15171A] border-white/15 text-[#F7F8FA]`, foco azul.
   - Botões primários: verde → **azul** (`bg-[#01B8FA]`, texto `#062B38`).
   - Caixas de erro: tint clara → `bg-red-500/10 border-red-500/40 text-red-200`.
   - Avatares de perfil (`ROLE_UI`): ADMIN em azul; demais em tom neutro no escuro.

2. **`frontend/src/index.css`**
   - Adicionado um bloco com escopo em **`.login-dark`** que "blinda" a tela.
   - **Por quê:** o `index.css` do app aplica um **tema claro global** com
     `!important` (força `input { background: var(--panel) }` e o anel de foco
     **verde**). Sem a blindagem, os inputs da login voltariam a ficar claros e
     o foco ficaria verde. As regras `.login-dark input ...` sobrescrevem isso
     **só dentro da tela de login**, sem afetar o resto do sistema.

## Paleta usada (espelha o `lumin-site`)

| Papel                | Site (token)      | Valor      |
|----------------------|-------------------|------------|
| Fundo / canvas       | `ink`             | `#08090A`  |
| Superfície (sidebar) | `ink-850`         | `#0B0C0E`  |
| Card / painel        | `ink-800`         | `#111214`  |
| Input                | `ink-700`         | `#15171A`  |
| Borda                | `line` / `strong` | `rgba(255,255,255,.08 / .14)` |
| Texto principal      | `paper`           | `#F7F8FA`  |
| Texto secundário     | `muted`           | `#9BA1AD`  |
| Texto terciário      | `muted-soft`      | `#6E7480`  |
| **Marca (azul)**     | `brand`           | **`#01B8FA`** |
| Marca (claro/hover)  | `brand-400`       | `#3DC8FB`  |
| Marca (escuro/active)| `brand-600`       | `#019BD3`  |
| Texto sobre o azul   | `brand-ink`       | `#062B38`  |

## Observações / cuidados

- **Fonte da marca:** o `index.html` do app já carrega **Comfortaa 600;700**,
  então o wordmark renderiza igual ao site. Se um dia a fonte sair do
  `index.html`, o `.font-logo` cai para Bricolage Grotesque (ainda legível).
- **Só a login é escura.** O restante do app continua no tema claro "Luz". A
  blindagem é intencionalmente limitada a `.login-dark` para não vazar.
- **Se for evoluir:** ao adicionar novos campos/inputs na login, mantenha-os
  dentro do container `.login-dark` para herdar o tema escuro automaticamente.
- **Deploy:** este repositório publica no Netlify. Fazer commit + push aqui
  **não** mexe no site (`lumin-site` / Vercel), e vice-versa.
