import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, EtapaKds, OrigemComanda, StatusComanda } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { money, sumMoney } from '../../common/utils/money.util';
import {
  CriarMesaDto,
  AtualizarMesaDto,
  AbrirComandaDto,
  AdicionarItensDto,
  FecharComandaDto,
  ItemComandaInputDto,
} from './dto/restaurante.dto';

export interface UsuarioCtx {
  id: string;
  nome?: string;
}

export interface ListarComandasFiltro {
  filialId?: string;
  status?: StatusComanda;
  mesaId?: string;
}

@Injectable()
export class RestauranteService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────────── MESAS ─────────────────────────────

  listarMesas(tenantId: string, filialId?: string, incluirInativas = false) {
    return this.prisma.mesa.findMany({
      where: {
        tenantId,
        ...(filialId ? { filialId } : {}),
        ...(incluirInativas ? {} : { ativo: true }),
      },
      orderBy: { numero: 'asc' },
    });
  }

  async criarMesa(tenantId: string, dto: CriarMesaDto) {
    const jaExiste = await this.prisma.mesa.findFirst({
      where: { tenantId, filialId: dto.filialId, numero: dto.numero },
      select: { id: true },
    });
    if (jaExiste) throw new BadRequestException(`Já existe a mesa nº ${dto.numero} nesta filial.`);
    return this.prisma.mesa.create({
      data: {
        tenantId,
        filialId: dto.filialId,
        numero: dto.numero,
        apelido: dto.apelido,
        lugares: dto.lugares ?? 4,
        posX: dto.posX,
        posY: dto.posY,
      },
    });
  }

  async atualizarMesa(tenantId: string, id: string, dto: AtualizarMesaDto) {
    await this.acharMesa(tenantId, id);
    return this.prisma.mesa.update({ where: { id }, data: { ...dto } });
  }

  async removerMesa(tenantId: string, id: string) {
    await this.acharMesa(tenantId, id);
    const abertas = await this.prisma.comanda.count({
      where: { mesaId: id, status: { in: ['ABERTA', 'FECHANDO'] } },
    });
    if (abertas > 0) {
      throw new BadRequestException('A mesa tem comanda aberta. Feche a conta antes de remover.');
    }
    // Soft delete: preserva histórico de comandas já fechadas.
    return this.prisma.mesa.update({ where: { id }, data: { ativo: false } });
  }

  private async acharMesa(tenantId: string, id: string) {
    const mesa = await this.prisma.mesa.findFirst({ where: { id, tenantId } });
    if (!mesa) throw new NotFoundException('Mesa não encontrada.');
    return mesa;
  }

  // ─────────────────────────── COMANDAS ────────────────────────────

  listarComandas(tenantId: string, filtro: ListarComandasFiltro) {
    return this.prisma.comanda.findMany({
      where: {
        tenantId,
        ...(filtro.filialId ? { filialId: filtro.filialId } : {}),
        ...(filtro.status ? { status: filtro.status } : {}),
        ...(filtro.mesaId ? { mesaId: filtro.mesaId } : {}),
      },
      include: { itens: true, mesa: { select: { numero: true, apelido: true } } },
      orderBy: { abertaEm: 'desc' },
    });
  }

  async getComanda(tenantId: string, id: string) {
    const comanda = await this.prisma.comanda.findFirst({
      where: { id, tenantId },
      include: { itens: { orderBy: { createdAt: 'asc' } }, mesa: true },
    });
    if (!comanda) throw new NotFoundException('Comanda não encontrada.');
    return comanda;
  }

  async abrirComanda(tenantId: string, user: UsuarioCtx, dto: AbrirComandaDto) {
    const origem = dto.origem ?? OrigemComanda.MESA;
    if (origem === OrigemComanda.MESA && !dto.mesaId) {
      throw new BadRequestException('Comanda de mesa exige mesaId.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Numeração sequencial por filial (max + 1).
      const ultima = await tx.comanda.findFirst({
        where: { tenantId, filialId: dto.filialId },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const numero = (ultima?.numero ?? 0) + 1;

      const itensData = (dto.itens ?? []).map((i) => this.montarItem(tenantId, i));
      const subtotal = sumMoney(itensData.map((i) => i.valorTotal));

      const comanda = await tx.comanda.create({
        data: {
          tenantId,
          filialId: dto.filialId,
          mesaId: dto.mesaId ?? null,
          numero,
          origem,
          status: StatusComanda.ABERTA,
          clienteNome: dto.clienteNome,
          pessoas: dto.pessoas ?? 1,
          garcomId: dto.garcomId ?? user.id,
          garcomNome: dto.garcomNome ?? user.nome,
          subtotal,
          total: subtotal,
          itens: itensData.length ? { create: itensData } : undefined,
        },
        include: { itens: true },
      });

      if (dto.mesaId) {
        await tx.mesa.updateMany({
          where: { id: dto.mesaId, tenantId },
          data: { status: 'OCUPADA' },
        });
      }

      return comanda;
    });
  }

  async adicionarItens(tenantId: string, comandaId: string, dto: AdicionarItensDto) {
    const comanda = await this.getComanda(tenantId, comandaId);
    if (comanda.status !== StatusComanda.ABERTA) {
      throw new BadRequestException('Só é possível lançar itens em comanda aberta.');
    }
    if (!dto.itens?.length) throw new BadRequestException('Informe ao menos um item.');

    return this.prisma.$transaction(async (tx) => {
      await tx.itemComanda.createMany({
        data: dto.itens.map((i) => ({ comandaId, ...this.montarItem(tenantId, i) })),
      });
      return this.recalcularTotais(tx, tenantId, comandaId);
    });
  }

  async removerItem(tenantId: string, comandaId: string, itemId: string) {
    const comanda = await this.getComanda(tenantId, comandaId);
    if (comanda.status !== StatusComanda.ABERTA) {
      throw new BadRequestException('Só é possível remover itens de comanda aberta.');
    }
    const item = comanda.itens.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado na comanda.');

    return this.prisma.$transaction(async (tx) => {
      await tx.itemComanda.delete({ where: { id: itemId } });
      return this.recalcularTotais(tx, tenantId, comandaId);
    });
  }

  /** Pede a conta: comanda → FECHANDO e mesa → CONTA (aguardando pagamento). */
  async pedirConta(tenantId: string, comandaId: string) {
    const comanda = await this.getComanda(tenantId, comandaId);
    if (comanda.status !== StatusComanda.ABERTA) {
      throw new BadRequestException('A conta só pode ser pedida em comanda aberta.');
    }
    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.comanda.update({
        where: { id: comandaId },
        data: { status: StatusComanda.FECHANDO },
        include: { itens: true },
      });
      if (comanda.mesaId) {
        await tx.mesa.updateMany({ where: { id: comanda.mesaId, tenantId }, data: { status: 'CONTA' } });
      }
      return atualizada;
    });
  }

  /** Fecha a conta: aplica taxa/desconto, comanda → FECHADA e libera a mesa. */
  async fecharComanda(tenantId: string, comandaId: string, dto: FecharComandaDto) {
    const comanda = await this.getComanda(tenantId, comandaId);
    if (comanda.status === StatusComanda.FECHADA || comanda.status === StatusComanda.CANCELADA) {
      throw new BadRequestException('Comanda já finalizada.');
    }

    const subtotal = sumMoney(comanda.itens.map((i) => i.valorTotal));
    const taxa = dto.aplicarTaxa10 ? money(subtotal * 0.1) : money(dto.taxaServico ?? 0);
    const desconto = money(dto.desconto ?? 0);
    const total = money(subtotal + taxa - desconto);
    if (total < 0) throw new BadRequestException('Desconto maior que o total da comanda.');

    return this.prisma.$transaction(async (tx) => {
      const fechada = await tx.comanda.update({
        where: { id: comandaId },
        data: {
          status: StatusComanda.FECHADA,
          subtotal,
          taxaServico: taxa,
          desconto,
          total,
          formaPagamento: dto.formaPagamento,
          observacoes: dto.observacoes,
          fechadaEm: new Date(),
        },
        include: { itens: true },
      });
      if (comanda.mesaId) {
        await tx.mesa.updateMany({ where: { id: comanda.mesaId, tenantId }, data: { status: 'LIVRE' } });
      }
      return fechada;
    });
  }

  async cancelarComanda(tenantId: string, comandaId: string) {
    const comanda = await this.getComanda(tenantId, comandaId);
    if (comanda.status === StatusComanda.FECHADA) {
      throw new BadRequestException('Não é possível cancelar comanda já paga.');
    }
    return this.prisma.$transaction(async (tx) => {
      const cancelada = await tx.comanda.update({
        where: { id: comandaId },
        data: { status: StatusComanda.CANCELADA, fechadaEm: new Date() },
      });
      if (comanda.mesaId) {
        await tx.mesa.updateMany({ where: { id: comanda.mesaId, tenantId }, data: { status: 'LIVRE' } });
      }
      return cancelada;
    });
  }

  // ──────────────────────── KDS (COZINHA) ──────────────────────────

  /** Fila da cozinha agrupada por etapa: FILA, PREPARO, PRONTO. */
  async listarKds(tenantId: string, filialId?: string) {
    const itens = await this.prisma.itemComanda.findMany({
      where: {
        tenantId,
        etapaKds: { in: [EtapaKds.FILA, EtapaKds.PREPARO, EtapaKds.PRONTO] },
        comanda: {
          status: { in: [StatusComanda.ABERTA, StatusComanda.FECHANDO] },
          ...(filialId ? { filialId } : {}),
        },
      },
      include: {
        comanda: { select: { numero: true, origem: true, mesaId: true, mesa: { select: { numero: true } } } },
      },
      orderBy: { enviadoEm: 'asc' },
    });

    return {
      FILA: itens.filter((i) => i.etapaKds === EtapaKds.FILA),
      PREPARO: itens.filter((i) => i.etapaKds === EtapaKds.PREPARO),
      PRONTO: itens.filter((i) => i.etapaKds === EtapaKds.PRONTO),
    };
  }

  async moverEtapaKds(tenantId: string, itemId: string, etapa: EtapaKds) {
    const item = await this.prisma.itemComanda.findFirst({ where: { id: itemId, tenantId } });
    if (!item) throw new NotFoundException('Item não encontrado.');
    return this.prisma.itemComanda.update({
      where: { id: itemId },
      data: { etapaKds: etapa, etapaAtualizadaEm: new Date() },
    });
  }

  // ─────────────────────────── HELPERS ─────────────────────────────

  private montarItem(tenantId: string, i: ItemComandaInputDto) {
    const quantidade = new Prisma.Decimal(i.quantidade);
    const preco = money(i.precoUnitario);
    const valorTotal = money(i.quantidade * preco);
    return {
      tenantId,
      produtoId: i.produtoId ?? null,
      descricao: i.descricao,
      quantidade,
      precoUnitario: new Prisma.Decimal(preco),
      valorTotal: new Prisma.Decimal(valorTotal),
      observacao: i.observacao ?? null,
    };
  }

  private async recalcularTotais(
    tx: Prisma.TransactionClient,
    tenantId: string,
    comandaId: string,
  ) {
    const itens = await tx.itemComanda.findMany({ where: { comandaId }, select: { valorTotal: true } });
    const subtotal = sumMoney(itens.map((i) => i.valorTotal));
    return tx.comanda.update({
      where: { id: comandaId },
      data: { subtotal, total: subtotal },
      include: { itens: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
