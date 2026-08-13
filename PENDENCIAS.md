# Pendências — Lumin PDV

O que ainda falta para o sistema estar 100% pronto para vender numa loja real.
Organizado por prioridade. Atualizado a cada avanço.

**Legenda:** 🔴 bloqueia venda real · 🟡 importante p/ produção · 🟢 melhoria

---

## 1. Pagamento com cartão (TEF)

- **Status:** só **simulado/desligado**. PayGo e SiTef são stubs (não implementados).
- 🔴 **Falta:** implementar um provider de verdade.
- **Decisão pendente:** quais marcas de maquininha priorizar (Stone? Mercado Pago? PagBank? Cielo?).
- **Plano recomendado:** arquitetura **multi-marca** (o `tef.ts` já está pronto pra isso), começando pelo **Mercado Pago Point** (grátis de licença, já usamos MP no sistema) e adicionando as outras conforme o cliente.
- **Enquanto não tem:** funciona hoje com **maquininha avulsa** — passa o cartão na máquina e registra o valor no PDV (`VITE_TEF_MODO=desligado`).
- ⚠️ **Não prometer "TEF integrado" para clientes ainda.**

---

## 2. Nota fiscal (NFC-e / NF-e)

### 2.1 NFC-e real (modelo 65 — venda ao consumidor) 🔴
- **Status:** **simulado ligado** (gera chave/QR fake). Provider real (Focus NF-e) está **codado**, mas não configurado.
- **Falta para valer:**
  - [ ] **Certificado A1** da empresa (o cadastro já existe e guarda cifrado no banco ✅)
  - [ ] Conta no **Focus NF-e** + `FOCUS_NFE_TOKEN`
  - [ ] **CSC / Token** da NFC-e (SEFAZ do estado)
  - [ ] **Dados fiscais nos produtos:** NCM, CFOP, CST/CSOSN, PIS/COFINS
  - [ ] Testar em **homologação** e validar com a **contadora**
  - [ ] Virar `NFCE_MODO=focus` + URL de produção

### 2.2 NF-e real (modelo 55 — venda para empresa) 🟡
- **Status:** **NÃO implementado.** `autorizar()`, cancelamento e carta de correção do modelo 55 lançam "não configurado" (TODO no código).
- **Falta:** montar o XML modelo 55 + assinatura + transmissão.
- **Relevância:** só se o cliente **emite nota para outras empresas**. Para mercadinho/consumidor final, a NFC-e (item 2.1) basta.

---

## 3. Produção e infraestrutura

### 3.1 Render — plano free 🟡
- A API **dorme** após 15 min sem uso (1º acesso do dia demora ~30–50s / pode falhar; tentar de novo).
- **Uploads de imagem são efêmeros** — somem a cada deploy.
- **Ação:** subir para plano **pago** quando for produção séria (sem sleep) e/ou mover uploads para storage externo (S3/Cloudinary).
- Obs.: o **certificado A1 fica no banco (Neon)**, então **não se perde** em deploy ✅.

### 3.2 Mercado Pago em produção (assinaturas) 🟡
- Hoje `MP_MODO=simulado` (sem cobrança real).
- **Falta:** `MP_MODO=producao` + `MP_ACCESS_TOKEN` de produção (`APP_USR-...`) + `FRONT_URL`/`APP_URL` públicos.

### 3.3 E-mail em produção 🟡
- Hoje `MAIL_MODO=simulado` (só loga no console).
- **Falta:** `MAIL_MODO=producao` + `RESEND_API_KEY` + domínio verificado no Resend + `MAIL_FROM`.

### 3.4 Site de apresentação — confirmar deploy 🟡
- Confirmar que o site (pasta `site/`) está **publicado e acessível**, e que os botões **Entrar/Assinar** levam ao app.
- Links atuais: app = `preeminent-trifle-c6611a.netlify.app` · site = `nimble-nasturtium.netlify.app`.

### 3.5 Domínio próprio (opcional) 🟢
- Hoje são subdomínios `.netlify.app`.
- Se quiser marca própria: registrar domínio (ex. `lumin-pdv.com.br`) e apontar para o app e o site.

---

## 4. Funcionalidades do sistema

### 4.1 Tela de PIN em Gerencial › Usuários ✅
- **Feito.** No modal de edição de usuário há o botão **"Definir PIN"**, que abre
  uma tela com PIN + confirmação (só dígitos, 4 casas) e chama `POST /auth/definir-pin`.
- O gerente já consegue definir/trocar o PIN de cada pessoa da loja pela interface
  (não depende mais do seed).

### 4.2 Gaveta de dinheiro — validar com hardware 🟡
- Código pronto (Web Serial), **nunca testado com gaveta física**. Validar na 1ª instalação.

### 4.3 Impressão térmica — validar em impressora real 🟡
- Cupom sai pelo navegador; validar largura/corte numa térmica real (58/80mm).

---

## 5. Testes que só dá para fazer na instalação

Rodar o roteiro ponta a ponta com hardware real (ver **GUIA-INSTALACAO.md**):
- [ ] Bipe do leitor (som OK / erro)
- [ ] Gaveta abre na venda em dinheiro
- [ ] Cupom imprime certo
- [ ] Cartão registra / TEF aprova
- [ ] NFC-e autoriza em homologação
- [ ] Sangria/Suprimento batem no relatório X/Z e na Tesouraria

---

## 6. Melhorias futuras (nice-to-have) 🟢

- **PIX integrado** (QR dinâmico) — junto com o Mercado Pago Point.
- Rotina de **backup** do banco.
- Relatórios adicionais conforme a necessidade do cliente.

---

## Resumo rápido — o que trava e o que não trava

| O que | Trava vender? | Situação |
|-------|---------------|----------|
| Bipe, sangria, caixa, cupom | Não | ✅ Prontos |
| Gaveta | Não | ✅ Pronto (validar hardware) |
| Cartão (maquininha avulsa) | Não | ✅ Funciona hoje |
| **TEF integrado** | Não (usa avulsa) | 🔴 A implementar |
| **NFC-e real** | **Depende do cliente** | 🔴 Config + certificado |
| NF-e modelo 55 | Só se emitir p/ empresa | 🟡 A implementar |
| Produção (Render/MP/e-mail) | Não p/ demo | 🟡 Virar chave no go-live |
| Tela de PIN | Não | ✅ Pronta |
