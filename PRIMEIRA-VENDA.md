# Plano da 1ª Venda — Lumin PDV

Roteiro direto para você fazer a **primeira venda do começo ao fim**, hoje, no
sistema já publicado (modo demonstração). É a "prova de vida": login → abrir
caixa → passar produtos → receber → cupom → fechar caixa.

> **Modo demo x modo real:** aqui a venda é **completa e real no sistema** (baixa
> estoque, entra no caixa, sai o cupom), mas **sem cobrança de cartão de verdade**
> e **sem nota fiscal** (cartão e NFC-e estão em *simulado*). Para a primeira venda
> **fiscal**, siga o **GUIA-INSTALACAO.md**. O que ainda falta virar chave está no
> **PENDENCIAS.md**.

**Tempo estimado:** 5–10 minutos.

---

## Antes de começar (1 minuto)

- [ ] Computador com **Chrome** ou **Edge** (a gaveta/serial só existe neles).
- [ ] Abra o app: **https://preeminent-trifle-c6611a.netlify.app**
- [ ] Não precisa de leitor, impressora ou maquininha para este teste — dá para
      fazer tudo pela tela. Se tiver impressora térmica instalada, o cupom sai nela.

**Logins de demonstração (já existem no sistema):**

| Perfil | E-mail | Senha | PIN |
|--------|--------|-------|-----|
| Administrador | `admin@mercado.com` | `admin123` | **1234** |
| Operador de Caixa | `caixa@mercado.com` | `caixa123` | **3456** |
| Gerente | `gerente@mercado.com` | `gerente123` | **2345** |
| Estoquista | `estoque@mercado.com` | `estoque123` | **4567** |

---

## Passo 1 — Acordar o servidor (30–50s no 1º acesso)

O backend está no plano grátis do Render e **"dorme"** após 15 min parado.

- [ ] No primeiro acesso do dia, a tela pode demorar ~30–50s ou dar erro.
- [ ] Se der erro, **espere 40s e tente de novo** — a partir daí fica rápido.

> Isso é só do plano grátis. Em produção séria sobe para o plano pago (sem sleep).

---

## Passo 2 — Entrar e escolher o perfil

O login é em duas partes: **vincular a loja uma vez** e depois **entrar pelo perfil + PIN**.

1. [ ] Na tela de login, use **e-mail + senha do Administrador** (`admin@mercado.com` / `admin123`).
2. [ ] Clique em **"Vincular e ver perfis"** — o computador fica vinculado à loja.
3. [ ] Aparecem os **perfis** (Administrador, Gerente, Caixa, Estoque).
4. [ ] Para a venda, clique no perfil **Operador de Caixa** e digite o **PIN 3456**.
   - (Pode usar o Administrador/PIN 1234 também — ele enxerga tudo.)

> No dia a dia da loja é só isso: clicar no perfil + PIN. Ninguém redigita e-mail.

---

## Passo 3 — Abrir o caixa (fundo de troco)

Toda venda pertence a um **turno de caixa**. Sem caixa aberto, não vende.

1. [ ] Ao entrar na **Frente de Caixa**, aparece a tela **Abrir Caixa**.
2. [ ] Informe o **fundo de troco** (o dinheiro que já está na gaveta). Ex.: `100,00`.
       Pode ser `0` se quiser.
3. [ ] Confirme. O caixa abre e você cai na tela de vendas.

---

## Passo 4 — Passar os produtos (o carrinho)

A loja demo já vem com **produtos cadastrados e com estoque**. Duas formas de lançar:

**A) Por nome (novidade):**
- [ ] Digite parte do nome no campo, ex.: **`arroz`**, **`coca`**, **`sabão`**.
- [ ] Aparece a **lista de sugestões** (nome, código, estoque e preço).
- [ ] Use **↑/↓ + Enter** ou **clique** para lançar. (A 1ª sugestão já vem marcada,
      então digitar o nome + **Enter** adiciona a de cima.)

**B) Por código de barras:**
- [ ] Se tiver leitor, **bipe** — entra na hora (som agudo = OK).
- [ ] Sem leitor, digite um código demo e tecle **Enter**, ex.: **`7891000000001`**.

**Quantidade:**
- [ ] Para vender vários, clique nos chips **×2, ×5…** antes de lançar, ou digite
      `5*` e depois bipe/escolha.
- [ ] Produto **por peso** (ex.: *Banana*, *Tomate*, açougue) abre um campo para
      digitar os **kg** — informe, ex., `0,750`.

- [ ] Confira o **Total a pagar** no painel da direita subindo conforme adiciona.

> Dica: adicione **2 ou 3 itens** diferentes para o teste ficar realista.

---

## Passo 5 — Finalizar e receber (F2)

1. [ ] Clique em **Finalizar (F2)** (ou tecle **F2**).
2. [ ] Escolha a forma:
   - **Dinheiro (F3):** digite o **valor recebido** (ex.: total `27,80`, recebido
     `50,00`) → o sistema mostra o **troco**. Enter finaliza.
   - **Cartão (F4):** em *simulado*, aprova uma transação **fake** (não cobra nada).
   - **PIX (F5):** idem, simulado.
3. [ ] Dá para **dividir o pagamento** (parte dinheiro, parte cartão) — vai lançando
       cada parcela até zerar o restante.
4. [ ] Ao completar o valor, a venda é **registrada**.

---

## Passo 6 — Cupom e gaveta

- [ ] O **cupom** é montado e enviado para impressão pelo navegador.
   - Com térmica instalada: sai o cupom (ajuste a largura em `VITE_CUPOM_LARGURA`
     80/58 se precisar — veja o GUIA-INSTALACAO.md).
   - Sem impressora: aparece a **janela de impressão** do navegador — pode
     cancelar; a venda **já está registrada**.
- [ ] Se pagou em **dinheiro** e a gaveta estiver configurada, ela **abre sozinha**.
- [ ] Na tela aparece **"Venda #N registrada"** com o total. Há botão **Reimprimir cupom**.

**🎉 Pronto: essa foi a sua primeira venda.**

---

## Passo 7 — (Opcional) Sangria e suprimento

Para testar o movimento de gaveta durante o turno:

- [ ] **Sangria (F7):** retira dinheiro da gaveta (ex.: guardar no cofre).
- [ ] **Suprimento (F8):** coloca dinheiro (reforço de troco).
- [ ] Os dois refletem no **relatório do turno** e na **Tesouraria**.

---

## Passo 8 — Fechar o caixa (relatório Z)

Para fechar a "prova completa":

1. [ ] Clique em **Fechar (F9)**.
2. [ ] O sistema mostra o **dinheiro esperado na gaveta** (fundo + vendas em
       dinheiro − sangrias + suprimentos).
3. [ ] Digite quanto **realmente** tem na gaveta (conferência) e confirme.
4. [ ] Sai o **Relatório Z** com o resumo do turno (vendas, formas de pagamento,
       diferença de caixa).

---

## Checklist da 1ª venda

- [ ] Servidor acordou e entrei no app
- [ ] Vinculei a loja e entrei pelo **perfil + PIN**
- [ ] Abri o caixa com fundo de troco
- [ ] Lancei produtos **por nome** e/ou **por código**
- [ ] Usei **×N** e/ou um produto **por peso**
- [ ] Finalizei recebendo em **dinheiro** (conferi o **troco**)
- [ ] O **cupom** foi gerado (impresso ou na janela do navegador)
- [ ] (Opcional) Testei **sangria/suprimento**
- [ ] Fechei o caixa e vi o **Relatório Z**

---

## Se algo travar (troubleshooting rápido)

- **Demora/erro no 1º acesso:** é o Render acordando. Espere ~40s e tente de novo.
- **Botão não aparece / tela velha:** o app é PWA e guarda cache. Force com
  **Ctrl + Shift + R**.
- **"Não abre a página de login":** confirme a URL do app
  (`preeminent-trifle-c6611a.netlify.app`) e recarregue.
- **Cupom não sai:** confira se há **impressora padrão** no Windows; sem térmica,
  a janela de impressão do navegador é o esperado (a venda já foi registrada).
- **PIN não confere:** use a tabela de logins acima; o gerente pode redefinir o PIN
  em **Gerencial › Usuários › Definir PIN**.

---

## Depois da 1ª venda — próximos passos

1. **Cadastrar seus produtos reais** (Gerencial/Cadastros) e ajustar preços.
2. **Definir os PINs** da sua equipe em *Usuários*.
3. Quando for vender **de verdade numa loja**, seguir o **GUIA-INSTALACAO.md**
   (impressora, gaveta, cartão e **NFC-e** com certificado A1 em homologação).
4. O que ainda falta ligar para produção está no **PENDENCIAS.md**.
