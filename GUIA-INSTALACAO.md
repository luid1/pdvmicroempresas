# Guia de Instalação — Lumin PDV (em uma empresa real)

Passo a passo para colocar o sistema para rodar em uma loja, do zero à primeira
venda fiscal. Marque cada item conforme for concluindo.

> **Regra de ouro:** primeiro tudo em **simulação/homologação**, faça uma venda
> de teste ponta a ponta, e só depois vire a chave para **produção**.

---

## 0. O que levar / ter em mãos

**Hardware da loja**
- [ ] Computador com **Windows** + navegador **Chrome ou Edge** (a gaveta usa Web Serial, que só existe nesses)
- [ ] **Impressora térmica** (58mm ou 80mm) instalada no Windows
- [ ] **Leitor de código de barras** USB (qualquer um "tipo teclado")
- [ ] **Gaveta de dinheiro** com cabo RJ11 ligada na impressora (opcional)
- [ ] **Maquininha de cartão** (POS) ou leitor Mercado Pago Point (opcional)

**Dados da empresa**
- [ ] CNPJ, Razão Social, Inscrição Estadual, endereço, regime tributário
- [ ] **Certificado digital A1** (arquivo `.pfx` + senha) — só para NFC-e real
- [ ] **CSC / Token IBPT** da NFC-e (fornecido pela SEFAZ do estado) — só para NFC-e real

---

## 1. Criar a conta da empresa (assinatura)

1. Abra o **site de apresentação** → botão **Assinar**
2. Preencha os dados da empresa e escolha o plano
3. Isso cria o **tenant** (empresa isolada) e o **usuário administrador**
4. Anote o **e-mail** e a **senha** do admin

> Em teste, o pagamento está em modo simulado (`MP_MODO=simulado`) — a assinatura
> é ativada na hora, sem cobrança.

---

## 2. Primeiro acesso e perfis

1. Abra o **app** → tela de login
2. **Vincular este computador:** entre uma vez com o e-mail/senha do **admin**
3. Aparecem os **perfis** (Administrador, Gerente, Caixa, Estoque)
4. Em **Gerencial › Usuários**, ajuste os perfis reais da loja e defina um **PIN de 4 dígitos** para cada pessoa
5. No dia a dia, cada operador entra só clicando no perfil + PIN (não digita e-mail)

---

## 3. Cadastros básicos (antes de vender)

- [ ] **Filial** — confirme a loja/filial ativa
- [ ] **Formas de pagamento** — Dinheiro, Cartão, PIX
- [ ] **Produtos** — descrição, código de barras, preço, unidade
- [ ] **Dados fiscais dos produtos** (só p/ NFC-e): **NCM**, **CFOP**, **CST/CSOSN**, origem, CST de PIS/COFINS

---

## 4. Impressora térmica (cupom)

1. Instale o **driver** da impressora no Windows e faça um teste de impressão
2. Defina a térmica como **impressora padrão** do navegador (ou selecione na hora da impressão)
3. Ajuste a **largura da bobina** no `netlify.toml`:
   - `VITE_CUPOM_LARGURA = "80"` (bobina 80mm) ou `"58"` (bobina pequena)
4. Faça uma venda de teste → o cupom deve sair automaticamente

> Não depende de driver ESC/POS específico: o cupom é montado em HTML e impresso
> pelo navegador. Funciona com qualquer térmica instalada.

---

## 5. Gaveta de dinheiro

Dois caminhos — escolha um:

**A) Pelo driver da impressora (mais simples)**
- Configure o "kick"/abertura de gaveta **no corte do cupom** no driver
- Deixe `VITE_GAVETA_MODO = "desligada"` no `netlify.toml`
- A gaveta abre sozinha quando o cupom é cortado

**B) Controlada pelo PDV (Web Serial)**
- Ligue `VITE_GAVETA_MODO = "serial"` no `netlify.toml`
- No PDV, clique **"Abrir gaveta"** uma vez e **autorize a porta** USB/serial
- A partir daí abre automático nas vendas em dinheiro e pelo botão manual

> Requer Chrome/Edge em **HTTPS** (o Netlify já é HTTPS).

---

## 6. Leitor de código de barras

- Plug & play: o leitor funciona como teclado
- Foque o campo "Bipe ou digite o código" e bipe → som **agudo** = OK, **grave** = não encontrado
- Multiplicador: digite `5*` e bipe o produto para lançar 5 unidades

---

## 7. Pagamento com cartão

Escolha conforme o cliente:

| Opção | Custo | Como ligar |
|-------|-------|-----------|
| **Maquininha avulsa (POS)** | Grátis (só a taxa do cartão) | `VITE_TEF_MODO = "desligado"`. Passa na maquininha e registra o valor no PDV. **Funciona hoje.** |
| **Mercado Pago Point / PIX** | Grátis de licença | Requer implementar o provider (a arquitetura já está pronta em `tef.ts`). Fale com o desenvolvedor. |
| **TEF SiTef / PayGo** | Pago (licença + contrato) | `VITE_TEF_MODO = "sitef"` ou `"paygo"` + gerenciador instalado + provider implementado. |

> **Modo de teste:** `VITE_TEF_MODO = "simulado"` aprova uma transação fake — ótimo
> para demonstração, **não** movimenta dinheiro de verdade.

---

## 8. NFC-e (nota fiscal do consumidor)

> ⚠️ Só ative a NFC-e **real** depois de testar em **homologação** e conferir com a **contadora**.

**Passo a passo (via gateway Focus NF-e — já implementado):**
1. Cadastre o **Certificado A1** da empresa no sistema
2. Informe o **CSC/Token** da NFC-e (SEFAZ do estado)
3. Confira os **dados fiscais** de cada produto (NCM, CFOP, CST/CSOSN)
4. No Render, configure:
   - `NFCE_MODO = focus`
   - `FOCUS_NFE_TOKEN = <token da conta Focus>`
   - `FOCUS_NFE_URL = https://homologacao.focusnfe.com.br` (homologação) → depois `https://api.focusnfe.com.br` (produção)
5. Faça uma venda em **homologação** → confira a chave, o QR e o DANFE
6. Só então mude a URL para **produção**

**Modos disponíveis (`NFCE_MODO`):**
- `desligado` — não emite nota (padrão)
- `simulado` — chave/QR **fake**, sem transmitir (para demonstração)
- `focus` — transmite de verdade via Focus NF-e (exige certificado + config)
- `sefaz` — SEFAZ direto (ainda não implementado)

---

## 9. Checklist final de "go-live"

Antes de liberar para o cliente vender de verdade:

- [ ] Cupom sai correto na largura certa
- [ ] Gaveta abre na venda em dinheiro
- [ ] Leitor bipa e encontra os produtos
- [ ] Sangria/Suprimento refletem no relatório X e na Tesouraria
- [ ] Abertura e fechamento de caixa (relatório Z) batem
- [ ] Cartão registrando o valor (maquininha) OU TEF integrado aprovando
- [ ] NFC-e autorizada em **homologação** e conferida pela contadora
- [ ] Variáveis viradas para **produção** (ver abaixo)

---

## 10. Virar a chave: teste → produção

**Frontend — `netlify.toml` → `[build.environment]`**
```
VITE_TEF_MODO     = "desligado"   # ou o TEF real, quando houver
VITE_GAVETA_MODO  = "serial"      # ou "desligada" se usar o kick do driver
VITE_CUPOM_LARGURA = "80"         # ou "58"
```

**Backend — Render → Environment (ou `render.yaml`)**
```
NFCE_MODO       = "focus"                        # nota fiscal real
FOCUS_NFE_TOKEN = <token>
FOCUS_NFE_URL   = https://api.focusnfe.com.br    # produção
MP_MODO         = "producao"                     # cobrança real da assinatura
MP_ACCESS_TOKEN = APP_USR-...                     # token de produção
```

> Depois de trocar variáveis, refaça o deploy e **Ctrl+Shift+R** no navegador
> (o app é PWA e guarda cache).

---

## 11. Observações do ambiente atual

- **Render (plano free):** a API "dorme" após 15 min sem uso e leva ~30–50s para
  acordar. O 1º login do dia pode demorar/dar erro; basta tentar de novo. Para
  produção séria, suba para um plano pago (sem sleep).
- **Uploads** no plano free são efêmeros (somem a cada deploy).
- **Multi-loja:** vários computadores da mesma loja apontam para o mesmo backend
  e compartilham os dados (mesmo `tenantId`).

---

*Dúvida em algum passo? Chame o desenvolvedor com o número do item acima.*
