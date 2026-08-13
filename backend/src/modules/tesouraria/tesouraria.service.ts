import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimento,
  OrigemMovimento,
  TipoContaFinanceira,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, sumMoney, assertValorPositivo } from '../../common/utils/money.util';
import {
  CriarContaFinanceiraDto,
  AtualizarContaFinanceiraDto,
  MovimentoAvulsoDto,
  TransferenciaDto,
  ImportarExtratoDto,
  ConciliarDto,
} from './dto/tesouraria.dto';

export interface UsuarioCtx {
  id: string;
  nome?: string;
}

/** Filtros da listagem de movimentos de caixa. */
export interface ListarMovimentosDto {
  contaId?: string;
  filialId?: string;
  origem?: OrigemMovimento;
  tipo?: TipoMovimento;
  dataIni?: string;
  dataFim?: string;
  conciliado?: string; // 'true' | 'false'
  search?: string;
}

/** Parâmetros do helper interno de registro de movimento (usado dentro de uma tx). */
export interface RegistrarMovimentoParams {
  tenantId: string;
  contaId: string;
  filialId?: string | null;
  tipo: TipoMovimento;
  valor: number;
  descricao: string;
  origem: OrigemMovimento;
  planoContasCodigo?: string | null;
  contaReceberId?: string | null;
  contaPagarId?: string | null;
  transferenciaId?: string | null;
  itemExtratoId?: string | null;
  conciliado?: boolean;
  data?: Date;
  usuario?: UsuarioCtx;
  observacoes?: string | null;
}

@Injectable()
export class TesourariaService {
  constructor(private prisma: PrismaService) {}

  // ─────────────── Serialização ───────────────

  private serializarConta(c: any) {
    return {
      ...c,
      saldoInicial: money(c.saldoInicial),
      saldoAtual: money(c.saldoAtual),
    };
  }

  private serializarMovimento(m: any) {
    return {
      ...m,
      valor: money(m.valor),
      saldoApos: money(m.saldoApos),
    };
  }

  // ─────────────── Contas financeiras (CRUD) ───────────────

  async listarContas(tenantId: string, incluirInativas = false) {
    const contas = await this.prisma.contaFinanceira.findMany({
      where: { tenantId, ...(incluirInativas ? {} : { ativo: true }) },
      orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
    });
    return contas.map((c) => this.serializarConta(c));
  }

  async findConta(tenantId: string, id: string) {
    const conta = await this.prisma.contaFinanceira.findFirst({ where: { id, tenantId } });
    if (!conta) throw new NotFoundException('Conta financeira não encontrada.');
    return this.serializarConta(conta);
  }

  async criarConta(tenantId: string, dto: CriarContaFinanceiraDto) {
    const saldo = money(dto.saldoInicial || 0);
    return this.prisma.$transaction(async (tx) => {
      if (dto.padrao) await this.limparPadrao(tx, tenantId);
      const conta = await tx.contaFinanceira.create({
        data: {
          tenantId,
          nome: dto.nome,
          tipo: dto.tipo || TipoContaFinanceira.BANCO,
          filialId: dto.filialId || null,
          banco: dto.banco || null,
          agencia: dto.agencia || null,
          numero: dto.numero || null,
          documento: dto.documento || null,
          saldoInicial: saldo,
          saldoAtual: saldo,
          padrao: dto.padrao || false,
        },
      });
      return this.serializarConta(conta);
    });
  }

  async atualizarConta(tenantId: string, id: string, dto: AtualizarContaFinanceiraDto) {
    await this.findConta(tenantId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.padrao) await this.limparPadrao(tx, tenantId);
      const conta = await tx.contaFinanceira.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(dto.banco !== undefined ? { banco: dto.banco || null } : {}),
          ...(dto.agencia !== undefined ? { agencia: dto.agencia || null } : {}),
          ...(dto.numero !== undefined ? { numero: dto.numero || null } : {}),
          ...(dto.documento !== undefined ? { documento: dto.documento || null } : {}),
          ...(dto.padrao !== undefined ? { padrao: dto.padrao } : {}),
          ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        },
      });
      return this.serializarConta(conta);
    });
  }

  /** Soft-delete: só permite inativar conta zerada e sem movimentos. */
  async removerConta(tenantId: string, id: string) {
    const conta = await this.prisma.contaFinanceira.findFirst({ where: { id, tenantId } });
    if (!conta) throw new NotFoundException('Conta financeira não encontrada.');
    const qtdMov = await this.prisma.movimentoCaixa.count({ where: { tenantId, contaId: id } });
    if (qtdMov > 0) {
      // Preserva histórico: apenas inativa.
      const atualizada = await this.prisma.contaFinanceira.update({
        where: { id },
        data: { ativo: false },
      });
      return this.serializarConta(atualizada);
    }
    await this.prisma.contaFinanceira.delete({ where: { id } });
    return { id, removido: true };
  }

  private async limparPadrao(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.contaFinanceira.updateMany({
      where: { tenantId, padrao: true },
      data: { padrao: false },
    });
  }

  // ─────────────── Registro de movimento (núcleo) ───────────────

  /**
   * Registra um MovimentoCaixa dentro de uma transação já aberta e atualiza o
   * saldoAtual da conta atomicamente. É o ponto único por onde todo dinheiro
   * entra/sai de uma conta — usado por baixas de título, avulsos, transferências
   * e conciliação. Retorna o movimento serializado.
   */
  async registrarMovimentoTx(
    tx: Prisma.TransactionClient,
    p: RegistrarMovimentoParams,
  ) {
    const valor = assertValorPositivo(p.valor, 'valor');
    const conta = await tx.contaFinanceira.findFirst({
      where: { id: p.contaId, tenantId: p.tenantId },
    });
    if (!conta) throw new NotFoundException('Conta financeira não encontrada.');
    if (!conta.ativo) throw new BadRequestException('Conta financeira inativa.');

    const delta = p.tipo === TipoMovimento.ENTRADA ? valor : -valor;
    const saldoApos = money(sumMoney([conta.saldoAtual, delta]));

    await tx.contaFinanceira.update({
      where: { id: conta.id },
      data: { saldoAtual: saldoApos },
    });

    const mov = await tx.movimentoCaixa.create({
      data: {
        tenantId: p.tenantId,
        filialId: p.filialId ?? conta.filialId ?? null,
        contaId: conta.id,
        tipo: p.tipo,
        origem: p.origem,
        valor,
        saldoApos,
        data: p.data || new Date(),
        descricao: p.descricao,
        planoContasCodigo: p.planoContasCodigo ?? null,
        contaReceberId: p.contaReceberId ?? null,
        contaPagarId: p.contaPagarId ?? null,
        transferenciaId: p.transferenciaId ?? null,
        itemExtratoId: p.itemExtratoId ?? null,
        conciliado: p.conciliado ?? false,
        usuarioId: p.usuario?.id ?? null,
        usuarioNome: p.usuario?.nome ?? null,
        observacoes: p.observacoes ?? null,
      },
    });
    return this.serializarMovimento(mov);
  }

  // ─────────────── Movimentos: listagem / avulso / transferência ───────────────

  async listarMovimentos(tenantId: string, filtros: ListarMovimentosDto) {
    const where: Prisma.MovimentoCaixaWhereInput = { tenantId };
    if (filtros.contaId) where.contaId = filtros.contaId;
    if (filtros.filialId) where.filialId = filtros.filialId;
    if (filtros.origem) where.origem = filtros.origem;
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.conciliado === 'true') where.conciliado = true;
    if (filtros.conciliado === 'false') where.conciliado = false;
    if (filtros.dataIni || filtros.dataFim) {
      where.data = {};
      if (filtros.dataIni) where.data.gte = new Date(filtros.dataIni);
      if (filtros.dataFim) where.data.lte = new Date(filtros.dataFim);
    }
    if (filtros.search) {
      where.descricao = { contains: filtros.search, mode: 'insensitive' };
    }
    const movs = await this.prisma.movimentoCaixa.findMany({
      where,
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return movs.map((m) => this.serializarMovimento(m));
  }

  async movimentoAvulso(tenantId: string, usuario: UsuarioCtx, dto: MovimentoAvulsoDto) {
    return this.prisma.$transaction((tx) =>
      this.registrarMovimentoTx(tx, {
        tenantId,
        contaId: dto.contaId,
        filialId: dto.filialId || null,
        tipo: dto.tipo,
        valor: dto.valor,
        descricao: dto.descricao,
        origem: OrigemMovimento.AVULSO,
        planoContasCodigo: dto.planoContasCodigo || null,
        data: dto.data ? new Date(dto.data) : undefined,
        usuario,
        observacoes: dto.observacoes || null,
      }),
    );
  }

  async transferencia(tenantId: string, usuario: UsuarioCtx, dto: TransferenciaDto) {
    if (dto.contaOrigemId === dto.contaDestinoId)
      throw new BadRequestException('Conta de origem e destino devem ser diferentes.');
    const valor = assertValorPositivo(dto.valor, 'valor');
    const transferenciaId = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const data = dto.data ? new Date(dto.data) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const origem = await tx.contaFinanceira.findFirst({
        where: { id: dto.contaOrigemId, tenantId },
      });
      const destino = await tx.contaFinanceira.findFirst({
        where: { id: dto.contaDestinoId, tenantId },
      });
      if (!origem || !destino)
        throw new NotFoundException('Conta de origem ou destino não encontrada.');
      if (money(origem.saldoAtual) < valor)
        throw new BadRequestException('Saldo insuficiente na conta de origem.');

      const descBase = dto.descricao || `Transferência ${origem.nome} → ${destino.nome}`;
      const saida = await this.registrarMovimentoTx(tx, {
        tenantId,
        contaId: origem.id,
        tipo: TipoMovimento.SAIDA,
        valor,
        descricao: descBase,
        origem: OrigemMovimento.TRANSFERENCIA,
        transferenciaId,
        data,
        usuario,
      });
      const entrada = await this.registrarMovimentoTx(tx, {
        tenantId,
        contaId: destino.id,
        tipo: TipoMovimento.ENTRADA,
        valor,
        descricao: descBase,
        origem: OrigemMovimento.TRANSFERENCIA,
        transferenciaId,
        data,
        usuario,
      });
      return { transferenciaId, saida, entrada };
    });
  }

  // ─────────────── Resumo / saldos ───────────────

  async resumo(tenantId: string) {
    const contas = await this.prisma.contaFinanceira.findMany({
      where: { tenantId, ativo: true },
      orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
    });
    const saldoTotal = sumMoney(contas.map((c) => c.saldoAtual));
    const porTipo: Record<string, number> = {};
    for (const c of contas) {
      porTipo[c.tipo] = money(sumMoney([porTipo[c.tipo] || 0, c.saldoAtual]));
    }
    const naoConciliados = await this.prisma.movimentoCaixa.count({
      where: { tenantId, conciliado: false },
    });
    return {
      saldoTotal,
      porTipo,
      qtdContas: contas.length,
      movimentosNaoConciliados: naoConciliados,
      contas: contas.map((c) => this.serializarConta(c)),
    };
  }

  // ─────────────── Conciliação (OFX) ───────────────

  /**
   * Importa um extrato bancário (linhas já parseadas do OFX). Idempotente por
   * (tenantId, extratoId, fitId): reimportar o mesmo arquivo não duplica itens.
   */
  async importarExtrato(tenantId: string, usuario: UsuarioCtx, dto: ImportarExtratoDto) {
    const conta = await this.prisma.contaFinanceira.findFirst({
      where: { id: dto.contaId, tenantId },
    });
    if (!conta) throw new NotFoundException('Conta financeira não encontrada.');
    if (!dto.itens?.length)
      throw new BadRequestException('Extrato sem itens para importar.');

    return this.prisma.$transaction(async (tx) => {
      const extrato = await tx.extratoBancario.create({
        data: {
          tenantId,
          contaId: dto.contaId,
          arquivo: dto.arquivo || null,
          periodoInicio: dto.periodoInicio ? new Date(dto.periodoInicio) : null,
          periodoFim: dto.periodoFim ? new Date(dto.periodoFim) : null,
          saldoFinal: dto.saldoFinal != null ? money(dto.saldoFinal) : null,
          usuarioId: usuario.id,
        },
      });

      let criados = 0;
      for (const item of dto.itens) {
        const valor = money(item.valor);
        const tipo = valor >= 0 ? TipoMovimento.ENTRADA : TipoMovimento.SAIDA;
        const fitId = item.fitId || `${item.data}|${valor}|${item.descricao}`.slice(0, 200);
        try {
          await tx.itemExtrato.create({
            data: {
              tenantId,
              extratoId: extrato.id,
              data: new Date(item.data),
              valor,
              tipo,
              descricao: item.descricao,
              documento: item.documento || null,
              fitId,
            },
          });
          criados++;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            // fitId duplicado — item já importado, ignora (idempotência)
            continue;
          }
          throw e;
        }
      }

      // Auto-conciliação por valor+data aproximada (±3 dias) com movimentos ainda
      // não conciliados da mesma conta.
      const itens = await tx.itemExtrato.findMany({
        where: { extratoId: extrato.id, conciliado: false },
      });
      let conciliadosAuto = 0;
      for (const item of itens) {
        const alvo = money(Math.abs(Number(item.valor)));
        const ini = new Date(item.data); ini.setDate(ini.getDate() - 3);
        const fim = new Date(item.data); fim.setDate(fim.getDate() + 3);
        const mov = await tx.movimentoCaixa.findFirst({
          where: {
            tenantId,
            contaId: dto.contaId,
            conciliado: false,
            tipo: item.tipo,
            valor: alvo,
            data: { gte: ini, lte: fim },
          },
          orderBy: { data: 'asc' },
        });
        if (mov) {
          await tx.movimentoCaixa.update({
            where: { id: mov.id },
            data: { conciliado: true, itemExtratoId: item.id },
          });
          await tx.itemExtrato.update({
            where: { id: item.id },
            data: { conciliado: true, movimentoId: mov.id },
          });
          conciliadosAuto++;
        }
      }

      return { extratoId: extrato.id, itensImportados: criados, conciliadosAuto };
    });
  }

  async listarExtratos(tenantId: string, contaId?: string) {
    return this.prisma.extratoBancario.findMany({
      where: { tenantId, ...(contaId ? { contaId } : {}) },
      orderBy: { importadoEm: 'desc' },
      include: { _count: { select: { itens: true } } },
    });
  }

  async listarItensExtrato(tenantId: string, extratoId: string) {
    const itens = await this.prisma.itemExtrato.findMany({
      where: { tenantId, extratoId },
      orderBy: { data: 'asc' },
    });
    return itens.map((i) => ({ ...i, valor: money(i.valor) }));
  }

  /**
   * Concilia manualmente um item do extrato: vincula a um MovimentoCaixa existente
   * ou cria um movimento de AJUSTE para representar a linha do banco.
   */
  async conciliar(tenantId: string, usuario: UsuarioCtx, dto: ConciliarDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemExtrato.findFirst({
        where: { id: dto.itemExtratoId, tenantId },
        include: { extrato: true },
      });
      if (!item) throw new NotFoundException('Item de extrato não encontrado.');
      if (item.conciliado) throw new BadRequestException('Item já conciliado.');

      let movimentoId = dto.movimentoId;
      if (movimentoId) {
        const mov = await tx.movimentoCaixa.findFirst({
          where: { id: movimentoId, tenantId },
        });
        if (!mov) throw new NotFoundException('Movimento não encontrado.');
        if (mov.conciliado) throw new BadRequestException('Movimento já conciliado.');
        await tx.movimentoCaixa.update({
          where: { id: mov.id },
          data: { conciliado: true, itemExtratoId: item.id },
        });
      } else {
        // Cria um movimento de ajuste espelhando a linha do extrato.
        const mov = await this.registrarMovimentoTx(tx, {
          tenantId,
          contaId: item.extrato.contaId,
          tipo: item.tipo,
          valor: Math.abs(Number(item.valor)),
          descricao: `Conciliação: ${item.descricao}`,
          origem: OrigemMovimento.AJUSTE,
          planoContasCodigo: dto.planoContasCodigo || null,
          data: item.data,
          conciliado: true,
          itemExtratoId: item.id,
          usuario,
        });
        movimentoId = mov.id;
      }

      await tx.itemExtrato.update({
        where: { id: item.id },
        data: { conciliado: true, movimentoId },
      });
      return { itemExtratoId: item.id, movimentoId, conciliado: true };
    });
  }
}
