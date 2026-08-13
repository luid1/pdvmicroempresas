import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, TipoLancamento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money } from '../../common/utils/money.util';
import { CriarPlanoContaDto, AtualizarPlanoContaDto } from './dto/plano-contas.dto';
import { CONTA, seedPlanoContas } from './plano-contas.seed';

/** Dados para lançar um fato no razão gerencial (LancamentoFinanceiro). */
export interface LancarDto {
  tenantId: string;
  filialId?: string | null;
  contaCodigo: string;        // código do plano (ex.: CONTA.ALUGUEL)
  valor: number;              // sempre positivo
  dataCompetencia?: Date;
  descricao: string;
  /** Tag de origem p/ idempotência e estorno (ex.: 'CP:<id>', 'COMISSAO:<id>'). */
  origem: string;
  /** Executa dentro de uma transação externa, se fornecida. */
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class PlanoContasService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────── CRUD ─────────────────────────

  /**
   * Lista o plano de contas do tenant. Se estiver vazio, semeia o plano padrão
   * (lazy seed) — assim tenants antigos ganham o plano na primeira abertura da tela.
   */
  async findAll(tenantId: string, incluirInativas = false) {
    await seedPlanoContas(this.prisma, tenantId);

    const contas = await this.prisma.planoContas.findMany({
      where: { tenantId, ...(incluirInativas ? {} : { ativo: true }) },
      orderBy: { codigo: 'asc' },
    });
    return contas;
  }

  /** Só as contas analíticas ativas (para selects de "categoria" em despesas). */
  async analiticas(tenantId: string) {
    const contas = await this.findAll(tenantId);
    return contas.filter((c) => c.analitica);
  }

  async findByCodigo(tenantId: string, codigo: string) {
    return this.prisma.planoContas.findUnique({
      where: { tenantId_codigo: { tenantId, codigo } },
    });
  }

  async create(tenantId: string, dto: CriarPlanoContaDto) {
    const codigo = dto.codigo.trim();
    const existe = await this.findByCodigo(tenantId, codigo);
    if (existe) throw new ConflictException(`Já existe uma conta com o código ${codigo}.`);

    // nível derivado da profundidade do código, se não informado.
    const nivel = dto.nivel ?? codigo.split('.').length;
    const pai = dto.pai ?? (nivel > 1 ? codigo.split('.').slice(0, -1).join('.') : null);

    return this.prisma.planoContas.create({
      data: {
        tenantId,
        codigo,
        descricao: dto.descricao.trim(),
        tipo: dto.tipo,
        nivel,
        pai,
        analitica: dto.analitica ?? nivel >= 3,
        ativo: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: AtualizarPlanoContaDto) {
    const conta = await this.prisma.planoContas.findFirst({ where: { id, tenantId } });
    if (!conta) throw new NotFoundException('Conta não encontrada.');

    // Se estiver desmarcando "analítica", garante que não tem lançamentos.
    if (dto.analitica === false && conta.analitica) {
      const usos = await this.prisma.lancamentoFinanceiro.count({
        where: { tenantId, planoContasId: conta.id },
      });
      if (usos > 0)
        throw new BadRequestException(
          'Conta com lançamentos não pode deixar de ser analítica.',
        );
    }

    return this.prisma.planoContas.update({
      where: { id: conta.id },
      data: {
        ...(dto.descricao !== undefined && { descricao: dto.descricao.trim() }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.analitica !== undefined && { analitica: dto.analitica }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
      },
    });
  }

  /** "Remove" = inativa (soft). Bloqueia se houver lançamentos vinculados. */
  async remove(tenantId: string, id: string) {
    const conta = await this.prisma.planoContas.findFirst({ where: { id, tenantId } });
    if (!conta) throw new NotFoundException('Conta não encontrada.');

    const usos = await this.prisma.lancamentoFinanceiro.count({
      where: { tenantId, planoContasId: conta.id },
    });
    if (usos > 0)
      throw new BadRequestException(
        `Conta possui ${usos} lançamento(s) e não pode ser removida. Inative-a se necessário.`,
      );

    return this.prisma.planoContas.update({
      where: { id: conta.id },
      data: { ativo: false },
    });
  }

  /** Reaplica o plano padrão (idempotente) — botão "restaurar padrão". */
  async semear(tenantId: string) {
    const criadas = await seedPlanoContas(this.prisma, tenantId);
    return { criadas };
  }

  // ─────────────── Razão gerencial (LancamentoFinanceiro) ───────────────

  /**
   * Lança um fato no razão, resolvendo a conta pelo código e usando a natureza
   * (DEBITO/CREDITO) definida no plano. IDEMPOTENTE pela tag `origem`: se já
   * existir um lançamento com a mesma origem, não duplica.
   *
   * A tag de origem é gravada no campo `historico` como `ORIGEM=<origem>`.
   */
  async lancar(dados: LancarDto) {
    const db = dados.tx ?? this.prisma;
    const valor = money(dados.valor);
    if (valor <= 0) return null;

    const conta = await db.planoContas.findUnique({
      where: { tenantId_codigo: { tenantId: dados.tenantId, codigo: dados.contaCodigo } },
    });
    if (!conta) {
      // conta ainda não semeada (tenant novo sem lazy-seed) — não derruba o fluxo.
      return null;
    }

    const tag = `ORIGEM=${dados.origem}`;
    const jaExiste = await db.lancamentoFinanceiro.count({
      where: { tenantId: dados.tenantId, historico: { contains: tag } },
    });
    if (jaExiste > 0) return null; // idempotência

    return db.lancamentoFinanceiro.create({
      data: {
        tenantId: dados.tenantId,
        filialId: dados.filialId ?? null,
        planoContasId: conta.id,
        tipo: conta.tipo,
        valor,
        dataCompetencia: dados.dataCompetencia ?? new Date(),
        descricao: dados.descricao,
        historico: tag,
      },
    });
  }

  /** Estorna (remove) todos os lançamentos de uma origem. Idempotente. */
  async estornar(tenantId: string, origem: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const tag = `ORIGEM=${origem}`;
    const res = await db.lancamentoFinanceiro.deleteMany({
      where: { tenantId, historico: { contains: tag } },
    });
    return { estornados: res.count };
  }

  // ─────────────── Agregação para o DRE ───────────────

  /**
   * Soma os lançamentos por conta analítica num período, para os blocos do DRE
   * que vêm do razão (despesas operacionais e financeiras: grupos 3.4 / 3.5,
   * e outras receitas 3.6). Retorna o total e o detalhamento por conta (drill-down).
   */
  async despesasPorConta(
    tenantId: string,
    inicio: Date,
    fim: Date,
    filialId?: string,
  ): Promise<{
    despesasOperacionais: { total: number; contas: { codigo: string; descricao: string; valor: number }[] };
    despesasFinanceiras: { total: number; contas: { codigo: string; descricao: string; valor: number }[] };
    outrasReceitas: { total: number; contas: { codigo: string; descricao: string; valor: number }[] };
  }> {
    const lancamentos = await this.prisma.lancamentoFinanceiro.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialId } : {}),
        dataCompetencia: { gte: inicio, lte: fim },
        planoContasId: { not: null },
      },
      include: { planoContas: { select: { codigo: true, descricao: true, tipo: true } } },
    });

    const acc = new Map<string, { codigo: string; descricao: string; valor: number }>();
    for (const l of lancamentos) {
      const pc = l.planoContas;
      if (!pc) continue;
      const atual = acc.get(pc.codigo) ?? { codigo: pc.codigo, descricao: pc.descricao, valor: 0 };
      atual.valor = money(atual.valor + money(l.valor));
      acc.set(pc.codigo, atual);
    }

    const filtrarPorPrefixo = (prefixo: string) => {
      const contas = [...acc.values()]
        .filter((c) => c.codigo.startsWith(prefixo))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
      const total = money(contas.reduce((s, c) => s + c.valor, 0));
      return { total, contas };
    };

    return {
      despesasOperacionais: filtrarPorPrefixo('3.4'),
      despesasFinanceiras: filtrarPorPrefixo('3.5'),
      outrasReceitas: filtrarPorPrefixo('3.6'),
    };
  }

  /** Reexporta os códigos semânticos para quem injeta o serviço. */
  readonly CONTA = CONTA;
  readonly TipoLancamento = TipoLancamento;
}
