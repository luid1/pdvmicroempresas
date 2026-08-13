import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import bcrypt from 'bcryptjs';

/**
 * Provisiona um novo tenant self-service: cria a empresa, a primeira filial
 * (matriz), os 4 perfis padrão (ADMIN/GERENTE/OPERADOR_CAIXA/ESTOQUISTA) e o
 * usuário dono (ADMIN). Espelha a lógica do `prisma/seed.ts`, mas por tenant e
 * dentro de uma transação — de modo que a compra de um plano já entregue um
 * ambiente 100% utilizável, sem intervenção manual.
 */
@Injectable()
export class ProvisionamentoService {
  private readonly log = new Logger('Provisionamento');

  constructor(private prisma: PrismaService) {}

  /** Garante que o conjunto global de permissões (MODULO×AÇÃO) exista. */
  private async garantirPermissoes() {
    const modulos = ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO', 'CADASTROS', 'AUDITORIA', 'RELATORIOS', 'GERENCIAL'];
    const acoes = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EMITIR', 'APROVAR', 'CANCELAR', 'OPERAR', 'CONFIGURAR'];
    for (const modulo of modulos) {
      for (const acao of acoes) {
        await this.prisma.permissao.upsert({
          where: { modulo_acao: { modulo, acao } },
          update: {},
          create: { modulo, acao, descricao: `${acao} em ${modulo}` },
        });
      }
    }
  }

  /**
   * Cria empresa + filial + perfis + usuário dono. Idempotente por CNPJ:
   * se o tenant já existir, lança ConflictException.
   */
  async provisionarTenant(input: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    adminNome: string;
    adminEmail: string;
    adminSenha: string;
  }): Promise<{ tenantId: string; filialId: string; usuarioId: string }> {
    const jaExiste = await this.prisma.tenant.findUnique({ where: { cnpj: input.cnpj } });
    if (jaExiste) throw new ConflictException('Já existe uma empresa cadastrada com este CNPJ.');

    await this.garantirPermissoes();
    const todasPermissoes = await this.prisma.permissao.findMany();

    const TELAS_GERENTE = [
      '/dashboard', '/pdv',
      '/cadastros/produtos', '/cadastros/tabelas-preco', '/cadastros/fornecedores', '/cadastros/clientes', '/cadastros/filiais',
      '/wms/posicao', '/wms/pereciveis', '/wms/entradas', '/wms/movimentacoes', '/wms/inventario', '/wms/compras', '/wms/devolucoes-compra', '/wms/analise-estoque',
      '/fiscal/emitir', '/fiscal/gestao', '/fiscal/nfe', '/fiscal/matriz',
      '/financeiro/dre', '/financeiro/fluxo-caixa', '/financeiro/receber', '/financeiro/pagar', '/financeiro/custos', '/financeiro/tesouraria', '/financeiro/plano-contas',
      '/gerencial/relatorios', '/gerencial/usuarios', '/gerencial/configuracoes', '/gerencial/auditoria',
    ];
    const TELAS_CAIXA = ['/pdv'];
    const TELAS_ESTOQUISTA = ['/cadastros/produtos', '/wms/posicao', '/wms/pereciveis', '/wms/entradas', '/wms/movimentacoes', '/wms/inventario', '/wms/compras'];

    const rolesDefs = [
      { nome: 'ADMIN', descricao: 'Dono / Administrador — acesso total', telas: ['*'], telaInicial: '/dashboard', perms: todasPermissoes.map((p) => p.id) },
      { nome: 'GERENTE', descricao: 'Gerente da loja', telas: TELAS_GERENTE, telaInicial: '/dashboard', perms: todasPermissoes.filter((p) => p.acao !== 'DELETE').map((p) => p.id) },
      { nome: 'OPERADOR_CAIXA', descricao: 'Operador de caixa (PDV)', telas: TELAS_CAIXA, telaInicial: '/pdv', perms: todasPermissoes.filter((p) => ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO'].includes(p.modulo) && ['CREATE', 'READ', 'UPDATE', 'EMITIR'].includes(p.acao)).map((p) => p.id) },
      { nome: 'ESTOQUISTA', descricao: 'Estoquista / repositor', telas: TELAS_ESTOQUISTA, telaInicial: '/wms/posicao', perms: todasPermissoes.filter((p) => (p.modulo === 'ESTOQUE' && p.acao !== 'DELETE') || (p.modulo === 'CADASTROS' && ['CREATE', 'READ', 'UPDATE'].includes(p.acao)) || (p.modulo === 'PEDIDOS' && p.acao === 'READ')).map((p) => p.id) },
    ];

    const senhaHash = await bcrypt.hash(input.adminSenha, 12);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          razaoSocial: input.razaoSocial,
          nomeFantasia: input.nomeFantasia || input.razaoSocial,
          cnpj: input.cnpj,
          regimeTributario: 'SIMPLES_NACIONAL',
          crt: 1,
        },
      });

      const filial = await tx.filial.create({
        data: {
          tenantId: tenant.id,
          codigo: '1001',
          nome: `${input.nomeFantasia || input.razaoSocial} - Loja 01`,
          tipo: 'MATRIZ',
          // Endereço vazio — o dono completa no onboarding (Cadastros › Filiais).
          endereco: { rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' },
        },
      });

      let adminRoleId = '';
      for (const rd of rolesDefs) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            nome: rd.nome,
            descricao: rd.descricao,
            telas: rd.telas,
            telaInicial: rd.telaInicial,
            permissoes: { create: rd.perms.map((id) => ({ permissaoId: id })) },
          },
        });
        if (rd.nome === 'ADMIN') adminRoleId = role.id;
      }

      const usuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          roleId: adminRoleId,
          nome: input.adminNome,
          email: input.adminEmail,
          passwordHash: senhaHash,
          filiais: { create: { filialId: filial.id } },
        },
      });

      this.log.log(`Tenant provisionado: ${tenant.razaoSocial} (${tenant.id})`);
      return { tenantId: tenant.id, filialId: filial.id, usuarioId: usuario.id };
    });
  }
}
