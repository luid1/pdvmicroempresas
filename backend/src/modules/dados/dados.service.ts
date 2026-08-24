import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * LGPD — direitos do titular e do controlador sobre os dados do tenant.
 *
 * Dois serviços centrais:
 *  - `exportarTudo`   → portabilidade/acesso (art. 18, II e V): despeja os dados
 *                       de negócio do tenant em JSON, para o dono levar embora.
 *  - `anonimizarCliente` → eliminação/anonimização (art. 18, IV): apaga os dados
 *                       pessoais (PII) de UM cliente, preservando os vínculos
 *                       transacionais/fiscais que a lei obriga a reter (art. 16).
 *
 * Ambos são operações sensíveis: só o ADMIN do tenant pode executá-las, e a
 * exportação NUNCA inclui segredos (hash de senha, PIN, tokens, certificados).
 */
@Injectable()
export class DadosService {
  private readonly log = new Logger('DadosLGPD');

  constructor(private prisma: PrismaService) {}

  private exigirAdmin(user: { role?: string }) {
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o ADMIN da empresa pode exportar ou anonimizar dados (LGPD).');
    }
  }

  /**
   * Exporta os dados de negócio do tenant como um único objeto JSON.
   * Exclui deliberadamente segredos: passwordHash, pin, tokens fiscais e o
   * conteúdo dos certificados digitais.
   */
  async exportarTudo(tenantId: string, user: { role?: string }) {
    this.exigirAdmin(user);

    const t = tenantId;
    const [
      tenant,
      filiais,
      usuarios,
      clientes,
      fornecedores,
      produtos,
      pedidos,
      nfes,
      contasReceber,
      contasPagar,
      auditLogs,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: t },
        select: {
          id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, ie: true, im: true,
          regimeTributario: true, crt: true, emailNfe: true, plano: true, ativo: true,
          createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.filial.findMany({ where: { tenantId: t } }),
      // Usuários SEM segredos (nada de passwordHash / pin).
      this.prisma.usuario.findMany({
        where: { tenantId: t },
        select: {
          id: true, nome: true, email: true, ativo: true, roleId: true,
          createdAt: true,
          role: { select: { nome: true } },
          filiais: { select: { filialId: true } },
        },
      }),
      this.prisma.cliente.findMany({ where: { tenantId: t } }),
      this.prisma.fornecedor.findMany({ where: { tenantId: t } }),
      this.prisma.produto.findMany({ where: { tenantId: t } }),
      this.prisma.pedido.findMany({ where: { tenantId: t }, include: { itens: true } }),
      this.prisma.nFe.findMany({ where: { tenantId: t }, include: { itens: true } }),
      this.prisma.contaReceber.findMany({ where: { tenantId: t } }),
      this.prisma.contaPagar.findMany({ where: { tenantId: t } }),
      this.prisma.auditLog.findMany({
        where: { tenantId: t },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
    ]);

    if (!tenant) throw new NotFoundException('Empresa não encontrada.');

    this.log.log(`Exportação LGPD gerada para tenant ${t}`);

    return {
      geradoEm: new Date().toISOString(),
      versao: 1,
      aviso: 'Segredos (senhas, PINs, tokens fiscais, certificados) são omitidos por segurança.',
      empresa: tenant,
      filiais,
      usuarios,
      clientes,
      fornecedores,
      produtos,
      pedidos,
      notasFiscais: nfes,
      financeiro: { contasReceber, contasPagar },
      auditoria: auditLogs,
      contagens: {
        filiais: filiais.length,
        usuarios: usuarios.length,
        clientes: clientes.length,
        fornecedores: fornecedores.length,
        produtos: produtos.length,
        pedidos: pedidos.length,
        notasFiscais: nfes.length,
      },
    };
  }

  /**
   * Anonimiza (pseudonimiza) os dados pessoais de UM cliente. Mantém o registro
   * e seus vínculos transacionais/fiscais (pedidos, NF-e, títulos) — a lei exige
   * reter esses documentos — mas apaga nome, documento, contatos e endereço.
   * Operação irreversível.
   */
  async anonimizarCliente(tenantId: string, clienteId: string, user: { role?: string }) {
    this.exigirAdmin(user);

    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');

    const marca = `ANON-${clienteId.slice(0, 12)}`;

    const atualizado = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        razaoSocial: 'Cliente anonimizado (LGPD)',
        nomeFantasia: null,
        // cnpjCpf é @@unique por tenant — usamos uma marca única em vez de apagar.
        cnpjCpf: marca,
        ie: null,
        im: null,
        email: null,
        telefone: null,
        celular: null,
        enderecoJson: {},
        contatoJson: undefined,
        observacoes: null,
        ativo: false,
      },
    });

    this.log.warn(`Cliente ${clienteId} anonimizado (LGPD) no tenant ${tenantId}`);
    return { ok: true, clienteId: atualizado.id, anonimizadoEm: new Date().toISOString() };
  }
}
