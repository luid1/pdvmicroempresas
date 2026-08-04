# Teste ponta a ponta — Lumin PDV (no ar, com o site publicado)

> **Para a nova sessão do Claude:** este arquivo é o seu roteiro. O objetivo é
> **testar o sistema publicado, de ponta a ponta**, simulando um cliente real:
> entra no **site** → **assina o plano** → **abre e instala o app (PWA)** →
> **entra e usa no dia a dia** (abre caixa, vende, recebe, tira cupom, fecha caixa)
> → **confere se os números refletem** no financeiro. Faça você mesmo pelo
> navegador e relate o que funcionou e o que travou.

---

## 0. O que você precisa saber antes

**Endereços (tudo já publicado):**

| O quê | URL |
|-------|-----|
| **Site** (apresentação + assinar) | https://nimble-nasturtium.netlify.app |
| **App** (sistema / PDV) | https://preeminent-trifle-c6611a.netlify.app |
| Backend (API) | Render — `lumin-pdv-api.onrender.com` (o app fala com ele via proxy `/api`) |

**Modo do ambiente = TESTE.** Nada cobra dinheiro de verdade:
- **Assinatura:** `MP_MODO=simulado` → o checkout diz *"Ambiente de teste — nenhuma cobrança agora"*. A conta é criada e liberada na hora.
- **Cartão / PIX no PDV:** *simulado* — aprova uma transação fake, não cobra nada.
- **NFC-e (nota fiscal):** *simulado* — gera chave/QR fake.
- **E-mail de boas-vindas:** *simulado* — pode não chegar de verdade (normal).

> ⚠️ **Regra de segurança:** como é modo teste, use **dados fictícios** no cadastro.
> **Nunca** digite número de cartão real, CPF/CNPJ real de terceiros, nem senha
> de verdade sua. Se em algum momento a tela pedir um **cartão real** para cobrar,
> **pare e me avise** — não é para acontecer neste ambiente.

**Ferramentas para testar:** use o **Chrome MCP** (`mcp__claude-in-chrome__*`) para
navegar, clicar e preencher — é o caminho certo para web. Se a extensão do Chrome
não estiver conectada, peça ao usuário para conectá-la. Tire prints ao longo do
caminho para registrar cada etapa.

**⚠️ Backend "dorme" (plano grátis do Render):** no **1º acesso do dia** a API pode
demorar **~30–50s** ou dar erro. Se der erro, **espere ~40s e tente de novo**.
A partir daí fica rápido. Isso **não é bug** — é o plano grátis.

**⚠️ Cache do PWA:** se a tela vier "velha" ou um botão não aparecer, force o
recarregamento com **Ctrl + Shift + R**.

---

## 1. Assinar o plano (no site)

1. Abra o **site**: https://nimble-nasturtium.netlify.app
2. Clique em **Assinar / Começar** (vai para a página de planos, `assinar.html`).
3. Escolha um plano (ex.: o intermediário) — período **Mensal** está ok.
4. No formulário do wizard, preencha com **dados fictícios**:
   - Razão social: ex. `Loja Teste Ponta a Ponta LTDA`
   - Nome fantasia: ex. `Mercado Teste`
   - CNPJ: um CNPJ **de teste, fictício** (só números)
   - Nome do responsável: ex. `Fulano de Teste`
   - **E-mail:** invente um único, ex. `teste+e2e@exemplo.com` (anote — será seu login)
   - **Senha:** crie uma com **6+ caracteres** (anote — será seu login)
5. Confirme (**Assinar agora / Continuar**).
6. **Esperado:** tela de sucesso *"Assinatura criada com sucesso! Ambiente de teste:
   seu acesso já está liberado. Entre em /login com seu e-mail e senha."*

> Se der **409 / CNPJ já existe**, troque o CNPJ e o e-mail e tente de novo (você
> já rodou o teste antes). Cada tenant é único por CNPJ.

**✔️ Checkpoint 1:** a assinatura foi criada e o site te mandou para o `/login` do app.

---

## 2. Abrir e instalar o app (PWA)

1. Abra o **app**: https://preeminent-trifle-c6611a.netlify.app
2. No Chrome/Edge, aparece o ícone de **instalar** na barra de endereço (ou menu
   ⋮ → *Instalar Lumin PDV*). Clique para instalar como aplicativo.
3. **Esperado:** o app abre numa janela própria (standalone), começando pela tela
   de login/PDV. O ícone fica na área de trabalho / menu iniciar.

**✔️ Checkpoint 2:** o app instalou e abre em janela própria.

---

## 3. Entrar com a conta que você criou

O login tem 2 partes: **vincular a loja uma vez** (e-mail+senha) e depois **entrar
pelo perfil**.

1. Na tela de login, clique em **Vincular / ver perfis** e informe o **e-mail e a
   senha** que você criou no passo 1.
2. Aparece o perfil **Administrador** (a conta nova vem só com o admin).
3. Clique no perfil **Administrador**.
   - **Atenção:** a conta nova **não tem PIN ainda**, então o app pede a **senha**
     (a mesma do passo 1) em vez do PIN de 4 dígitos. Isso é o esperado.
4. Entre.

> **Importante — a loja nova nasce VAZIA:** sem produtos cadastrados e sem PINs de
> operador (só o admin, que entra por senha). Para testar a venda você vai
> precisar **cadastrar pelo menos 1 produto** (passo 4a).
>
> **Atalho, se quiser pular o cadastro:** existe uma **loja demo já pronta** (com
> produtos, estoque e PINs). Se o foco for só validar o fluxo de venda rápido,
> use a conta demo abaixo em vez da conta nova. Mas para provar o fluxo
> **"assina → instala → usa"** de verdade, faça com a conta nova.

**Logins da loja DEMO (já existem, já têm produtos):**

| Perfil | E-mail | Senha | PIN |
|--------|--------|-------|-----|
| Administrador | `admin@mercado.com` | `admin123` | **1234** |
| Operador de Caixa | `caixa@mercado.com` | `caixa123` | **3456** |
| Gerente | `gerente@mercado.com` | `gerente123` | **2345** |
| Estoquista | `estoque@mercado.com` | `estoque123` | **4567** |

**✔️ Checkpoint 3:** você entrou no sistema.

---

## 4. Usar no dia a dia (o fluxo principal)

### 4a. (Só na conta nova) Cadastrar 1–2 produtos

- Vá em **Cadastros › Produtos** (ou Gerencial › Produtos) → **Novo produto**.
- Crie 1–2 itens simples com **preço** e **estoque** (ex.: `Refrigerante` R$ 8,00,
  estoque 50; `Arroz 5kg` R$ 25,00, estoque 30). Um código de barras qualquer ajuda.
- *(Na loja demo pule esta etapa — já tem produtos.)*

### 4b. (Opcional) Definir PIN do operador

- Gerencial › **Usuários** → editar um usuário → **Definir PIN** (4 dígitos).
- No dia a dia da loja é assim que a equipe entra (perfil + PIN, sem redigitar e-mail).

### 4c. Abrir o caixa

- Vá para a **Frente de Caixa (PDV)**. Aparece **Abrir Caixa**.
- Informe o **fundo de troco** (ex.: `100,00`, pode ser `0`) e confirme.

### 4d. Passar produtos

- Digite parte do **nome** (ex.: `refri`, `arroz`) → escolha na lista (↑/↓ + Enter
  ou clique). Ou digite o **código de barras** + Enter.
- Teste **quantidade** (chips ×2/×5 ou `5*`). Confira o **Total** subindo à direita.
- Coloque **2–3 itens** para ficar realista.

### 4e. Finalizar e receber (F2)

- **Finalizar (F2)** → escolha a forma:
  - **Dinheiro (F3):** digite o **valor recebido** (ex.: total `41,00`, recebido
    `50,00`) → confira o **troco**. Enter finaliza.
  - **Cartão (F4) / PIX (F5):** *simulado* — aprova fake, não cobra. Pode testar também.
- Dá para **dividir** (parte dinheiro, parte cartão). Ao zerar o restante, a venda
  é **registrada**.

### 4f. Cupom

- O **cupom** vai para a impressão do navegador. **Sem impressora térmica**, aparece
  a janela de impressão — pode **cancelar**, a venda **já está registrada**.
- Na tela: **"Venda #N registrada"** com o total, e botão **Reimprimir**.

### 4g. (Opcional) Sangria / Suprimento

- **Sangria (F7):** retira dinheiro. **Suprimento (F8):** coloca dinheiro. Ambos
  batem no relatório do turno e na Tesouraria.

### 4h. Fechar o caixa (Relatório Z)

- **Fechar (F9)** → o sistema mostra o **dinheiro esperado** (fundo + vendas em
  dinheiro − sangrias + suprimentos).
- Digite quanto **realmente** tem na gaveta e confirme → sai o **Relatório Z**
  (resumo do turno, formas de pagamento, diferença de caixa).

**✔️ Checkpoint 4:** venda registrada, cupom gerado e caixa fechado com Relatório Z.

---

## 5. Conferir se os números refletem (financeiro)

Depois de vender, verifique que a venda apareceu nos lugares certos:

- **Relatórios / Dashboard:** a venda entra no total do dia.
- **Financeiro › Tesouraria:** a entrada em dinheiro/cartão bate.
- **Financeiro › Fluxo de Caixa:** entradas do período aumentaram.
- **Financeiro › Controladoria** (Visão consolidada): abas *Fluxo / Receber / Pagar*
  com os KPIs reais do período.
- **Financeiro › DRE:** receita do período.

**✔️ Checkpoint 5:** os valores da venda aparecem no financeiro.

---

## 6. O que é simulado (não reporte como bug)

- **Cartão / PIX** no PDV → aprova fake, não cobra.
- **NFC-e** → chave/QR fake (nota fiscal real depende de certificado + config).
- **Cobrança da assinatura** (Mercado Pago) → simulada, sem cartão real.
- **E-mail de boas-vindas** → simulado, pode não chegar.
- **Cold start do backend** (~30–50s no 1º acesso) → é o plano grátis do Render.

Detalhes completos do que ainda falta virar chave estão em **`PENDENCIAS.md`**.

---

## 7. Observação importante sobre deploy

- **O deploy do app é MANUAL** (arrastar a pasta `frontend/dist` para o Netlify).
  O que está **no ar** pode estar **atrás** do código local.
- Em especial: a tela **Financeiro › Controladoria** foi recém-ligada aos dados
  reais no código local, **mas ainda pode não estar publicada**. Se, no site, a
  Controladoria mostrar dados que parecem "de exemplo" (grandes clientes,
  fornecedores fixos), é porque a versão publicada ainda é a antiga — **avise**,
  que basta republicar o `frontend/dist`.

---

## 8. Como relatar no fim

Monte um resumo curto com:
- ✅/❌ de cada checkpoint (1 a 5).
- Prints das telas-chave (sucesso da assinatura, PDV com itens, cupom/venda
  registrada, Relatório Z, financeiro refletindo).
- Qualquer travamento: **em qual passo**, **mensagem de erro**, e se **recarregar
  (Ctrl+Shift+R)** ou **esperar o backend acordar** resolveu.
- Tempo aproximado do 1º acesso (para sabermos o impacto do cold start).

---

### Resumo de 1 linha
**Site → Assinar (teste, sem cobrança) → abrir app → instalar PWA → login (conta nova
entra por senha; loja nasce vazia, cadastre 1 produto — ou use a conta demo) →
abrir caixa → vender → receber → cupom → fechar caixa (Z) → conferir financeiro.**
