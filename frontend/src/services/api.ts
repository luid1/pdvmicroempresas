import axios from 'axios';

// timeout global: nenhuma tela pode ficar presa "carregando" para sempre quando
// o servidor está lento/fora do ar — o axios estoura em 15s e a tela mostra o erro.
const api = axios.create({ baseURL: '/api/v1', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wms_token');
  const filial = localStorage.getItem('wms_filial');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (filial) config.headers['x-filial-id'] = JSON.parse(filial).id;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      ['wms_token', 'wms_user', 'wms_filial', 'wms_filiais'].forEach((k) => localStorage.removeItem(k));
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// Auth / perfil do usuário
export const authApi = {
  // Lista viva de filiais; nao depende do snapshot gravado no login.
  filiais: () => api.get('/filiais'),
  // Preferências de UI que seguem a conta (merge raso no backend).
  salvarPreferencias: (preferencias: Record<string, unknown>) =>
    api.put('/auth/me/preferencias', { preferencias }),
};

// Empresa (tenant) — inclui o MODO de operação, persistido server-side.
export const empresaApi = {
  get: () => api.get('/empresa'),
  definirModo: (modo: 'VAREJO' | 'RESTAURANTE' | 'HIBRIDO') =>
    api.put('/empresa/modo', { modo }),
};

// Estoque / WMS
export const estoqueApi = {
  posicao: (filialId: string, alertaValidade?: boolean) =>
    api.get(`/estoque/${filialId}/saldo`, { params: { alertaValidade } }),
  saldoProduto: (filialId: string, produtoId: string) =>
    api.get(`/estoque/${filialId}/saldo/${produtoId}`),
  alertasValidade: (filialId: string, dias?: number) =>
    api.get(`/estoque/${filialId}/alertas-validade`, { params: { dias } }),
  movimentacoes: (filialId: string, params?: object) =>
    api.get(`/estoque/${filialId}/movimentacoes`, { params }),
  ajuste: (data: object) => api.post('/estoque/ajuste', data),
  transferencia: (data: object) => api.post('/estoque/transferencia', data),
};

// NF-e
export const nfeApi = {
  list: (filialId: string, params?: object) => api.get(`/nfe/${filialId}`, { params }),
  get: (id: string) => api.get(`/nfe/documento/${id}`),
  gerarDePedido: (pedidoId: string, filialId: string) =>
    api.post(`/nfe/gerar-de-pedido/${pedidoId}`, { filialId }),
  emitir: (id: string) => api.post(`/nfe/${id}/emitir`),
  cancelar: (id: string, motivo: string) => api.patch(`/nfe/${id}/cancelar`, { motivo }),
};

// NFC-e (modelo 65) — emissão do caixa + Monitor Fiscal
export const nfceApi = {
  // Está habilitada a emissão? Em qual modo (desligado/simulado/real)?
  status: () => api.get('/nfce/status'),
  // Monitor Fiscal: lista de documentos com status real e pendências.
  monitor: (params?: { filialId?: string; status?: string; busca?: string; dias?: number }) =>
    api.get('/nfce/monitor', { params }),
  // Contadores por status para os cards do topo do Monitor.
  resumo: (filialId?: string) => api.get('/nfce/monitor/resumo', { params: { filialId } }),
  // Detalhe de um documento (com itens).
  documento: (id: string) => api.get(`/nfce/documento/${id}`),
  // Emite NFC-e a partir de uma venda do PDV (store-and-forward: nunca perde a venda).
  emitirDePedido: (pedidoId: string, filialId: string, cpfNota?: string) =>
    api.post(`/nfce/emitir-de-pedido/${pedidoId}`, { filialId, cpfNota }),
  // Reenvia ao SEFAZ um documento pendente/contingência.
  transmitir: (id: string) => api.post(`/nfce/documento/${id}/transmitir`),
  // Cobra do SEFAZ o status real (aprovada? cancelada?) e reconcilia no sistema.
  consultar: (id: string) => api.post(`/nfce/documento/${id}/consultar`),
  // Cancela uma NFC-e autorizada.
  cancelar: (id: string, motivo?: string) => api.post(`/nfce/documento/${id}/cancelar`, { motivo }),
  // Fila de reenvio: reprocessa todos os pendentes/contingência.
  reprocessar: (filialId?: string) => api.post('/nfce/reprocessar', { filialId }),
};

// Pedidos
export const pedidosApi = {
  list: (filialId: string, params?: object) => api.get('/pedidos', { params: { filialId, ...params } }),
  get: (id: string) => api.get(`/pedidos/${id}`),
  create: (data: object) => api.post('/pedidos', data),
  updateStatus: (id: string, status: string) => api.patch(`/pedidos/${id}/status`, { status }),
  confirmar: (id: string) => api.patch(`/pedidos/${id}/confirmar`),
  reposicao: (id: string, data: object) => api.post(`/pedidos/${id}/reposicao`, data),
};

// PDV — frente de caixa
export const pdvApi = {
  buscarProduto: (codigo: string, filialId?: string) =>
    api.get('/pdv/produto', { params: { codigo, filialId } }),
  buscarProdutos: (termo: string, filialId?: string) =>
    api.get('/pdv/produtos', { params: { termo, filialId } }),
  registrarVenda: (data: {
    filialId: string;
    formaPagamento?: string;
    valorRecebido?: number;
    pagamentos?: {
      forma: string;
      valor: number;
      valorRecebido?: number;
      bandeira?: string;
      nsu?: string;
      autorizacao?: string;
    }[];
    itens: { produtoId: string; quantidade: number; precoUnit: number; descricao?: string; unidade?: string }[];
    desconto?: number;
    descontoTipo?: 'VALOR' | 'PERCENT';
    descontoPercent?: number;
    cpfNota?: string;
  }) => api.post('/pdv/venda', data),
  // Autorização de supervisor/fiscal p/ operações sensíveis (estorno, sangria, etc.)
  autorizarSupervisor: (data: { email: string; senha: string; acao?: string }) =>
    api.post('/pdv/autorizacao', data),
  // Autorização por SENHA GERENCIAL interna da loja (modelo simples do mercadinho).
  autorizarGerencial: (data: { filialId: string; senha: string; acao?: string }) =>
    api.post('/pdv/autorizacao-gerencial', data),
  // Configuração do caixa por loja: senha gerencial + quais operações exigem senha.
  configCaixaGet: (filialId: string) => api.get('/pdv/config', { params: { filialId } }),
  configCaixaSalvar: (data: {
    filialId: string;
    senhaGerencial?: string;
    senhaCancelarVenda?: boolean;
    senhaRemoverItem?: boolean;
    senhaDesconto?: boolean;
    senhaSangria?: boolean;
    senhaSuprimento?: boolean;
    senhaFecharCaixa?: boolean;
    senhaEstorno?: boolean;
  }) => api.put('/pdv/config', data),
  // Sessão / turno de caixa
  sessaoAtual: (filialId?: string) => api.get('/pdv/sessao/atual', { params: { filialId } }),
  abrirSessao: (data: { filialId: string; saldoInicial?: number; observacoes?: string }) =>
    api.post('/pdv/sessao/abrir', data),
  sangria: (data: { valor: number; descricao?: string }) => api.post('/pdv/sessao/sangria', data),
  suprimento: (data: { valor: number; descricao?: string }) => api.post('/pdv/sessao/suprimento', data),
  fecharSessao: (data: {
    saldoFinalInformado: number;
    cartaoInformado?: number;
    pixInformado?: number;
    observacoes?: string;
  }) => api.post('/pdv/sessao/fechar', data),
  relatorio: (sessaoId: string) => api.get(`/pdv/sessao/${sessaoId}/relatorio`),
  // Vendas registradas (reimpressão / estorno)
  vendasRecentes: (filialId?: string, limite?: number) =>
    api.get('/pdv/vendas', { params: { filialId, limite } }),
  cupomVenda: (pedidoId: string) => api.get(`/pdv/venda/${pedidoId}/cupom`),
  estornarVenda: (pedidoId: string) => api.post(`/pdv/venda/${pedidoId}/estornar`),
};

// Clientes
export const clientesApi = {
  list: (params?: object) => api.get('/clientes', { params }),
  get: (id: string) => api.get(`/clientes/${id}`),
  create: (data: object) => api.post('/clientes', data),
  update: (id: string, data: object) => api.put(`/clientes/${id}`, data),
};

// Produtos
export const produtosApi = {
  list: (params?: object) => api.get('/produtos', { params }),
  get: (id: string) => api.get(`/produtos/${id}`),
  create: (data: object) => api.post('/produtos', data),
  update: (id: string, data: object) => api.put(`/produtos/${id}`, data),
  buscarPorBarras: (codigo: string) => api.get('/produtos/barras/' + codigo),
};

// Compras (Ordens de Compra) + Fornecedores + sugestão de reposição
export const comprasApi = {
  list: (params?: object) => api.get('/compras', { params }),
  get: (id: string) => api.get(`/compras/${id}`),
  create: (data: object) => api.post('/compras', data),
  update: (id: string, data: object) => api.put(`/compras/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/compras/${id}/status`, { status }),
  aComprar: (filialId: string) => api.get(`/estoque/${filialId}/a-comprar`),
  historicoProduto: (produtoId: string) => api.get(`/compras/produto/${produtoId}/historico`),
};

export const fornecedoresApi = {
  list: (params?: object) => api.get('/fornecedores', { params }),
};

// Entradas de mercadoria (recebimento)
export const entradasApi = {
  list: (params?: object) => api.get('/entradas', { params }),
  get: (id: string) => api.get(`/entradas/${id}`),
};

// Financeiro
export const financeiroApi = {
  // Contas a Receber
  receber: (params?: object) => api.get('/contas-receber', { params }),
  receberResumo: (params?: object) => api.get('/contas-receber/resumo', { params }),
  receberDetalhe: (id: string) => api.get(`/contas-receber/${id}`),
  criarReceber: (data: object) => api.post('/contas-receber', data),
  baixarReceber: (id: string, data: object) => api.patch(`/contas-receber/${id}/baixar`, data),
  cancelarReceber: (id: string, motivo?: string) =>
    api.patch(`/contas-receber/${id}/cancelar`, { motivo }),
  // Contas a Pagar
  pagar: (params?: object) => api.get('/contas-pagar', { params }),
  pagarResumo: (params?: object) => api.get('/contas-pagar/resumo', { params }),
  pagarDetalhe: (id: string) => api.get(`/contas-pagar/${id}`),
  criarPagar: (data: object) => api.post('/contas-pagar', data),
  baixarPagar: (id: string, data: object) => api.patch(`/contas-pagar/${id}/baixar`, data),
  cancelarPagar: (id: string, motivo?: string) =>
    api.patch(`/contas-pagar/${id}/cancelar`, { motivo }),
  // Plano de Contas
  planoContas: {
    list: (incluirInativas?: boolean) =>
      api.get('/plano-contas', { params: incluirInativas ? { incluirInativas: 'true' } : {} }),
    analiticas: () => api.get('/plano-contas/analiticas'),
    criar: (data: object) => api.post('/plano-contas', data),
    atualizar: (id: string, data: object) => api.patch(`/plano-contas/${id}`, data),
    remover: (id: string) => api.delete(`/plano-contas/${id}`),
    semear: () => api.post('/plano-contas/semear'),
  },
  // Relatórios
  dre: (params?: object) => api.get('/dre', { params }),
  dreCompleto: (params?: object) => api.get('/dre/completo', { params }),
};

// Fluxo de Caixa (consolidado realizado)
export const fluxoCaixaApi = {
  consolidado: (params?: object) => api.get('/fluxo-caixa', { params }),
};

// Custos & Margem (rentabilidade por cliente/produto, composição de custo)
export const custosApi = {
  margem: (filialId: string, params?: { dataIni?: string; dataFim?: string }) =>
    api.get(`/custos/${filialId}/margem`, { params }),
  rentabilidade: (filialId: string, params?: { dataIni?: string; dataFim?: string }) =>
    api.get(`/custos/${filialId}/rentabilidade`, { params }),
  composicao: (filialId: string, q?: string) =>
    api.get(`/custos/${filialId}/composicao`, { params: q ? { q } : {} }),
};

// Tesouraria — contas financeiras, caixa e conciliação (Frente G)
export const tesourariaApi = {
  // Contas financeiras
  contas: (incluirInativas?: boolean) =>
    api.get('/tesouraria/contas', { params: incluirInativas ? { incluirInativas: 'true' } : {} }),
  conta: (id: string) => api.get(`/tesouraria/contas/${id}`),
  criarConta: (data: object) => api.post('/tesouraria/contas', data),
  atualizarConta: (id: string, data: object) => api.patch(`/tesouraria/contas/${id}`, data),
  removerConta: (id: string) => api.delete(`/tesouraria/contas/${id}`),
  resumo: () => api.get('/tesouraria/resumo'),
  // Movimentos
  movimentos: (params?: object) => api.get('/tesouraria/movimentos', { params }),
  movimentoAvulso: (data: object) => api.post('/tesouraria/movimentos', data),
  transferir: (data: object) => api.post('/tesouraria/transferencias', data),
  // Conciliação (OFX)
  extratos: (contaId?: string) => api.get('/tesouraria/extratos', { params: contaId ? { contaId } : {} }),
  itensExtrato: (extratoId: string) => api.get(`/tesouraria/extratos/${extratoId}/itens`),
  importarExtrato: (data: object) => api.post('/tesouraria/extratos/importar', data),
  conciliar: (data: object) => api.post('/tesouraria/conciliar', data),
};

// Despesas recorrentes (Frente I)
export const recorrenciasApi = {
  listar: (ativo?: boolean) =>
    api.get('/recorrencias', { params: ativo === undefined ? {} : { ativo: String(ativo) } }),
  get: (id: string) => api.get(`/recorrencias/${id}`),
  preview: (id: string, quantidade = 6) =>
    api.get(`/recorrencias/${id}/preview`, { params: { quantidade } }),
  criar: (data: object) => api.post('/recorrencias', data),
  atualizar: (id: string, data: object) => api.patch(`/recorrencias/${id}`, data),
  remover: (id: string) => api.delete(`/recorrencias/${id}`),
  gerar: () => api.post('/recorrencias/gerar', {}),
};

// Auditoria
export const auditoriaApi = {
  logs: (params?: object) => api.get('/auditoria', { params }),
};

// Relatórios gerenciais (Frente L)
export const relatoriosApi = {
  curvaABC: (params: { tipo?: 'produto' | 'cliente'; de?: string; ate?: string; filialId?: string }) =>
    api.get('/relatorios/curva-abc', { params }),
  giroEstoque: (params: { de?: string; ate?: string; filialId?: string }) =>
    api.get('/relatorios/giro-estoque', { params }),
  ranking: (params: { tipo?: 'vendedor' | 'cliente' | 'produto'; de?: string; ate?: string; filialId?: string }) =>
    api.get('/relatorios/ranking', { params }),
  agingFinanceiro: (params?: { filialId?: string }) =>
    api.get('/relatorios/aging-financeiro', { params }),
};

// Notificações (Frente K)
export const notificacoesApi = {
  list: (params?: { naoLidas?: boolean; limit?: number }) =>
    api.get('/notificacoes', {
      params: { naoLidas: params?.naoLidas ? 'true' : undefined, limit: params?.limit },
    }),
  naoLidas: () => api.get('/notificacoes/nao-lidas'),
  marcarLida: (id: string) => api.post(`/notificacoes/${id}/lida`, {}),
  marcarTodasLidas: () => api.post('/notificacoes/marcar-todas-lidas', {}),
  remover: (id: string) => api.delete(`/notificacoes/${id}`),
  gerar: () => api.post('/notificacoes/gerar', {}),
};

// Precificação por tabela (Frente M.2)
export const precificacaoApi = {
  listar: (params?: { produtoId?: string; tabela?: string; search?: string }) =>
    api.get('/precificacao/tabelas', { params }),
  resolver: (params: { produtoId: string; tabela?: string; clienteId?: string; data?: string }) =>
    api.get('/precificacao/resolver', { params }),
  resolverLote: (dto: { produtoIds: string[]; tabela?: string; clienteId?: string; data?: string }) =>
    api.post('/precificacao/resolver-lote', dto),
  upsert: (dto: {
    produtoId: string;
    tabela: string;
    preco: number;
    promoAtiva?: boolean;
    promoPreco?: number | null;
    promoInicio?: string | null;
    promoFim?: string | null;
    ativo?: boolean;
  }) => api.post('/precificacao/tabelas', dto),
  remover: (id: string) => api.delete(`/precificacao/tabelas/${id}`),
};

// Devoluções de compra ao fornecedor (Frente M.1)
export const devolucoesCompraApi = {
  list: (params?: { fornecedorId?: string; status?: string }) =>
    api.get('/devolucoes-compra', { params }),
  get: (id: string) => api.get(`/devolucoes-compra/${id}`),
  create: (dto: {
    filialId: string;
    fornecedorId?: string;
    entradaId?: string;
    motivo?: string;
    observacoes?: string;
    itens: { produtoId: string; descricao?: string; quantidade: number; valorUnitario?: number; loteId?: string }[];
  }) => api.post('/devolucoes-compra', dto),
};

// Assistente IA "Lu"
export type PerguntaLu = 'mais-vendido' | 'acabando' | 'mais-lucrativo';
export type TurnoLu = { autor: 'user' | 'lu'; texto: string };
export const iaApi = {
  // "Oi Lu, como está minha loja hoje?" — resumo do dia da loja logada.
  resumoDia: (filialId?: string) => api.get('/ia/resumo-dia', { params: { filialId } }),
  // Perguntas fixas (mais vendido / o que está acabando / mais lucrativo).
  perguntar: (tipo: PerguntaLu, filialId?: string) => api.get('/ia/perguntar', { params: { tipo, filialId } }),
  // Chat aberto (v0.3): pergunta livre sobre a loja, com memória curta.
  chat: (pergunta: string, historico?: TurnoLu[], filialId?: string) =>
    api.post('/ia/chat', { pergunta, historico, filialId }),
  // Barra de comando (v0.4): interpreta uma frase e devolve ação/resposta/esclarecimento.
  comando: (texto: string, historico?: TurnoLu[], filialId?: string) =>
    api.post('/ia/comando', { texto, historico, filialId }),
};

// Resultado do POST /ia/comando (barra de comando da Lu).
export type ComandoLuResp =
  | { tipo: 'resposta'; texto: string; via?: string }
  | { tipo: 'esclarecer'; texto: string }
  | {
      tipo: 'acao';
      acao: 'lancar-gasto' | 'lancar-entrada';
      resumo: string;
      rascunho: {
        acao: string;
        tipoMovimento: 'ENTRADA' | 'SAIDA';
        valor: number;
        descricao: string;
        categoriaTexto: string | null;
        data: string;
      };
    }
  | {
      tipo: 'acao';
      acao: 'transferir-estoque';
      resumo: string;
      rascunho: {
        acao: 'transferir-estoque';
        filialOrigemId: string;
        filialOrigemNome: string;
        filialDestinoId: string;
        filialDestinoNome: string;
        produtoId: string;
        produtoCodigo: string;
        produtoDescricao: string;
        unidade: string;
        quantidade: number;
        saldoDisponivel: number;
        observacoes: string | null;
      };
    }
  | {
      tipo: 'acao';
      acao: 'cadastrar-produto';
      resumo: string;
      rascunho: {
        acao: 'cadastrar-produto';
        descricao: string;
        codigo: string | null;
        codigoBarras: string | null;
        unidadeSigla: string;
        ncm: string;
        categoria: string | null;
        precoCompra: number | null;
        precoVenda: number | null;
        estoqueMinimo: number | null;
        vendidoPorPeso: boolean;
      };
    };

// Painel do DONO DA PLATAFORMA (SaaS) — cross-tenant, restrito ao super-admin.
export const plataformaApi = {
  listarLojas: (params?: { q?: string; status?: string }) =>
    api.get('/plataforma/lojas', { params }),
  obterLoja: (id: string) => api.get(`/plataforma/lojas/${id}`),
  criarLoja: (data: object) => api.post('/plataforma/lojas', data),
  atualizarLoja: (id: string, data: object) => api.patch(`/plataforma/lojas/${id}`, data),
  adicionarFilial: (lojaId: string, data: object) =>
    api.post(`/plataforma/lojas/${lojaId}/filiais`, data),
  atualizarFilial: (filialId: string, data: object) =>
    api.put(`/plataforma/filiais/${filialId}`, data),
  toggleFilial: (filialId: string, ativo: boolean) =>
    api.patch(`/plataforma/filiais/${filialId}/toggle`, { ativo }),
};

// Restaurante — mesas, comandas e KDS (modos Restaurante/Híbrido)
export interface ItemComandaInput {
  produtoId?: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  observacao?: string;
}
export const restauranteApi = {
  // Mesas
  listarMesas: (filialId?: string, incluirInativas?: boolean) =>
    api.get('/restaurante/mesas', {
      params: { filialId, incluirInativas: incluirInativas ? 'true' : undefined },
    }),
  criarMesa: (data: {
    filialId: string;
    numero: number;
    apelido?: string;
    lugares?: number;
    posX?: number;
    posY?: number;
  }) => api.post('/restaurante/mesas', data),
  atualizarMesa: (id: string, data: object) => api.patch(`/restaurante/mesas/${id}`, data),
  removerMesa: (id: string) => api.delete(`/restaurante/mesas/${id}`),
  // Comandas
  listarComandas: (params?: { filialId?: string; status?: string; mesaId?: string }) =>
    api.get('/restaurante/comandas', { params }),
  getComanda: (id: string) => api.get(`/restaurante/comandas/${id}`),
  abrirComanda: (data: {
    filialId: string;
    mesaId?: string;
    origem?: 'MESA' | 'BALCAO' | 'DELIVERY';
    clienteNome?: string;
    pessoas?: number;
    garcomId?: string;
    garcomNome?: string;
    itens?: ItemComandaInput[];
  }) => api.post('/restaurante/comandas', data),
  adicionarItens: (comandaId: string, itens: ItemComandaInput[]) =>
    api.post(`/restaurante/comandas/${comandaId}/itens`, { itens }),
  removerItem: (comandaId: string, itemId: string) =>
    api.delete(`/restaurante/comandas/${comandaId}/itens/${itemId}`),
  pedirConta: (comandaId: string) => api.post(`/restaurante/comandas/${comandaId}/pedir-conta`, {}),
  fecharComanda: (
    comandaId: string,
    data: {
      aplicarTaxa10?: boolean;
      taxaServico?: number;
      desconto?: number;
      formaPagamento?: string;
      observacoes?: string;
    },
  ) => api.post(`/restaurante/comandas/${comandaId}/fechar`, data),
  cancelarComanda: (comandaId: string) =>
    api.post(`/restaurante/comandas/${comandaId}/cancelar`, {}),
  // KDS (cozinha)
  listarKds: (filialId?: string) => api.get('/restaurante/kds', { params: { filialId } }),
  moverEtapaKds: (itemId: string, etapa: 'FILA' | 'PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO') =>
    api.patch(`/restaurante/kds/${itemId}`, { etapa }),
};

// Assinatura / capacidade (add-ons contratáveis no painel)
export const assinaturaApi = {
  me: () => api.get('/assinaturas/me'),
  addonsCatalogo: () => api.get('/assinaturas/addons'),
  alterarAddons: (dto: { pdvs?: number; usuarios?: number; filiais?: number }) =>
    api.patch('/assinaturas/me/addons', dto),
};
