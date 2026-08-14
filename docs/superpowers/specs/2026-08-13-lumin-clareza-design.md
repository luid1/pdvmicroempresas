# Lumin ERP + PDV — direção visual “Clareza”

**Data:** 2026-08-13  
**Escopo:** aplicação web pós-login, login e assistente Lu  
**Status:** direção vigente

## Objetivo

Dar ao produto uma aparência limpa, silenciosa e conversacional, inspirada na
clareza de produtos modernos de IA, sem copiar marca, logotipo ou componentes
proprietários. A identidade continua sendo **Lumin**.

## Fundamentos

- Canvas neutro `#F7F7F8`, painéis brancos e bordas `#E5E7EB`.
- Texto principal `#202123`; sidebar grafite `#212121`.
- Marca Lumin em verde-petróleo `#0F8A72`, com hover `#0B6F5C`.
- Verde de sucesso, vermelho de erro e âmbar de alerta têm papéis separados.
- Cards com raio de 14 px, sombra mínima e movimento de hover de no máximo 1 px.
- Inter para leitura, Bricolage Grotesque para títulos, JetBrains Mono para
  números e Comfortaa somente no wordmark.

## Regras de interface

1. A cor de marca indica foco, seleção e ação principal; não comunica sucesso.
2. Âmbar aparece somente em atenção, validade, ruptura ou risco operacional.
3. Dados densos continuam compactos, mas com títulos claros e áreas clicáveis
   de pelo menos 36 px quando o contexto permitir.
4. O PDV preserva velocidade, atalhos e alto contraste; a migração visual não
   pode acrescentar etapas ao fechamento de venda.
5. Componentes novos devem usar os tokens de `frontend/src/index.css` e o kit de
   `frontend/src/modules/cadastros/ui.tsx`.
6. Nenhuma tela ou módulo é removido só por estar fora do novo padrão visual.
   Exclusões dependem de comprovação de desuso e validação funcional.

## Ordem de migração

1. Tokens, AppShell, assistente Lu e Dashboard.
2. Componentes compartilhados, tabelas, formulários e modais.
3. Cadastros, estoque, financeiro e fiscal.
4. PDV, login e fluxos móveis, com testes de operação e responsividade.

Cada etapa deve passar por tipagem, build e inspeção visual antes do commit.
