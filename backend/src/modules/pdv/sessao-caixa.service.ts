import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoMovimento, OrigemMovimento, TipoContaFinanceira } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TesourariaService } from '../tesouraria/tesouraria.service';
import { AbrirSessaoDto, MovimentoCaixaDto, FecharSessaoDto } from './dto/pdv.dto';

interface UsuarioCtx {
  id: string;
  nome?: string;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class SessaoCaixaService {
  constructor(
    private prisma: PrismaService,
    private tesouraria: TesourariaService,
  ) {}

  /** Conta de CAIXA do tenant — encontra a padrão/primeira ou cria uma. */
  async getContaCaixa(tenantId: string, filialId: string) {
    const existente = await this.prisma.contaFinanceira.findFirst({
      where: { tenantId, tipo: TipoContaFinanceira.CAIXA, ativo: true },
      orderBy: [{ padrao: 'desc' }, { createdAt: 'asc' }],
    });
    if (existente) return existente;
    return this.prisma.contaFinanceira.create({
      data: {
        tenantId, filialId, nome: 'Caixa da Loja',
        tipo: TipoContaFinanceira.CAIXA, padrao: true, ativo: true,
      },
    });
  }

  /** Sessão ABERTA do operador na filial, ou null. */
  async sessaoAtual(tenantId: string, operadorId: string, filialId?: string) {
    return this.prisma.sessaoCaixa.findFirst({
      where: { tenantId, operadorId, status: 'ABERTA', ...(filialId && { filialId }) },
      orderBy: { abertaEm: 'desc' },
    });
  }

  /** Garante que há uma sessão aberta (usado antes de registrar venda). */
  async exigirSessaoAberta(tenantId: string, operadorId: string, filialId: string) {
    const sessao = await this.sessaoAtual(tenantId, operadorId, filialId);
    if (!sessao) {
      throw new BadRequestException('Nenhum caixa aberto. Abra o caixa antes de registrar vendas.');
    }
    return sessao;
  }

  async abrir(tenantId: string, usuario: UsuarioCtx, dto: AbrirSessaoDto) {
    const jaAberta = await this.sessaoAtual(tenantId, usuario.id, dto.filialId);
    if (jaAberta) throw new BadRequestException('Você já tem um caixa aberto. Feche-o antes de abrir outro.');

    const filial = await this.prisma.filial.findFirst({ where: { id: dto.filialId, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');

    const conta = await this.getContaCaixa(tenantId, dto.filialId);
    const saldoInicial = round2(Number(dto.saldoInicial || 0));

    const sessao = await this.prisma.sessaoCaixa.create({
      data: {
        tenantId,
        filialId: dto.filialId,
        contaId: conta.id,
        operadorId: usuario.id,
        operadorNome: usuario.nome || null,
        status: 'ABERTA',
        saldoInicial,
        observacoesAbertura: dto.observacoes || null,
        movimentos: {
          create: {
            tenantId,
            tipo: 'ABERTURA',
            valor: saldoInicial,
            descricao: 'Abertura de caixa (fundo de troco)',
            usuarioId: usuario.id,
            usuarioNome: usuario.nome || null,
          },
        },
      },
    });
    return sessao;
  }

  /** Registra a venda dentro da sessão (chamado pelo PdvService após a venda).
   *  Aceita pagamento dividido: um MovimentoSessao por forma e um incremento
   *  por categoria (dinheiro/cartão/pix), mas conta a venda apenas uma vez. */
  async registrarVendaNaSessao(
    tenantId: string,
    sessaoId: string,
    p: {
      pagamentos: {
        categoria: 'DINHEIRO' | 'CARTAO' | 'PIX';
        formaDetalhada: string;
        valor: number;
        info?: string;
      }[];
      pedidoId: string;
      numero: number;
      usuario: UsuarioCtx;
    },
  ) {
    const inc: Record<string, number> = { totalDinheiro: 0, totalCartao: 0, totalPix: 0 };
    const campoDe = (c: 'DINHEIRO' | 'CARTAO' | 'PIX') =>
      c === 'DINHEIRO' ? 'totalDinheiro' : c === 'CARTAO' ? 'totalCartao' : 'totalPix';

    const ops: any[] = [];
    for (const pg of p.pagamentos) {
      const valor = round2(pg.valor);
      inc[campoDe(pg.categoria)] += valor;
      ops.push(
        this.prisma.movimentoSessao.create({
          data: {
            tenantId,
            sessaoId,
            tipo: 'VENDA',
            formaPagamento: pg.formaDetalhada,
            valor,
            descricao: `Venda PDV #${p.numero}${pg.info ? ' · ' + pg.info : ''}`,
            pedidoId: p.pedidoId,
            usuarioId: p.usuario.id,
            usuarioNome: p.usuario.nome || null,
          },
        }),
      );
    }

    ops.push(
      this.prisma.sessaoCaixa.update({
        where: { id: sessaoId },
        data: {
          totalDinheiro: { increment: round2(inc.totalDinheiro) },
          totalCartao: { increment: round2(inc.totalCartao) },
          totalPix: { increment: round2(inc.totalPix) },
          qtdVendas: { increment: 1 },
        },
      }),
    );

    await this.prisma.$transaction(ops);
  }

  private async movimentoManual(
    tenantId: string,
    usuario: UsuarioCtx,
    dto: MovimentoCaixaDto,
    tipo: 'SANGRIA' | 'SUPRIMENTO',
  ) {
    const valor = round2(Number(dto.valor));
    if (!(valor > 0)) throw new BadRequestException('Valor deve ser maior que zero.');

    const aberta = await this.sessaoAtual(tenantId, usuario.id);
    if (!aberta) throw new BadRequestException('Nenhum caixa aberto.');

    const campo = tipo === 'SANGRIA' ? 'totalSangria' : 'totalSuprimento';
    const label = tipo === 'SANGRIA' ? 'Sangria' : 'Suprimento';

    await this.prisma.movimentoSessao.create({
      data: {
        tenantId,
        sessaoId: aberta.id,
        tipo,
        valor,
        descricao: dto.descricao || label,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome || null,
      },
    });
    await this.prisma.sessaoCaixa.update({
      where: { id: aberta.id },
      data: { [campo]: { increment: valor } },
    });

    // Reflete o dinheiro que sai/entra fisicamente da gaveta na conta financeira.
    await this.prisma.$transaction((tx) =>
      this.tesouraria.registrarMovimentoTx(tx, {
        tenantId,
        contaId: aberta.contaId,
        filialId: aberta.filialId,
        tipo: tipo === 'SANGRIA' ? TipoMovimento.SAIDA : TipoMovimento.ENTRADA,
        valor,
        descricao: `${label} de caixa · sessão ${aberta.id.slice(0, 8)}`,
        origem: OrigemMovimento.AVULSO,
        usuario: { id: usuario.id, nome: usuario.nome },
      }),
    );

    return this.relatorio(tenantId, aberta.id);
  }

  sangria(tenantId: string, usuario: UsuarioCtx, dto: MovimentoCaixaDto) {
    return this.movimentoManual(tenantId, usuario, dto, 'SANGRIA');
  }

  suprimento(tenantId: string, usuario: UsuarioCtx, dto: MovimentoCaixaDto) {
    return this.movimentoManual(tenantId, usuario, dto, 'SUPRIMENTO');
  }

  async fechar(tenantId: string, usuario: UsuarioCtx, dto: FecharSessaoDto) {
    const aberta = await this.sessaoAtual(tenantId, usuario.id);
    if (!aberta) throw new BadRequestException('Nenhum caixa aberto para fechar.');

    const saldoCalculado = round2(
      Number(aberta.saldoInicial) +
        Number(aberta.totalDinheiro) +
        Number(aberta.totalSuprimento) -
        Number(aberta.totalSangria),
    );
    const informado = round2(Number(dto.saldoFinalInformado));
    const diferenca = round2(informado - saldoCalculado);

    // Conferência de cartão/PIX na maquininha (opcional): guarda o informado e a
    // diferença contra o que o sistema registrou nas vendas.
    const cartaoInformado =
      dto.cartaoInformado != null ? round2(Number(dto.cartaoInformado)) : null;
    const pixInformado = dto.pixInformado != null ? round2(Number(dto.pixInformado)) : null;
    const diferencaCartao =
      cartaoInformado != null ? round2(cartaoInformado - Number(aberta.totalCartao)) : null;
    const diferencaPix =
      pixInformado != null ? round2(pixInformado - Number(aberta.totalPix)) : null;

    await this.prisma.sessaoCaixa.update({
      where: { id: aberta.id },
      data: {
        status: 'FECHADA',
        fechadaEm: new Date(),
        saldoFinalCalculado: saldoCalculado,
        saldoFinalInformado: informado,
        diferenca,
        cartaoInformado,
        pixInformado,
        diferencaCartao,
        diferencaPix,
        observacoesFechamento: dto.observacoes || null,
      },
    });

    return this.relatorio(tenantId, aberta.id);
  }

  /** Relatório X (caixa aberto, parcial) ou Z (caixa fechado, definitivo). */
  async relatorio(tenantId: string, sessaoId: string) {
    const s = await this.prisma.sessaoCaixa.findFirst({ where: { id: sessaoId, tenantId } });
    if (!s) throw new NotFoundException('Sessão não encontrada.');

    const saldoCalculado =
      s.saldoFinalCalculado != null
        ? Number(s.saldoFinalCalculado)
        : round2(
            Number(s.saldoInicial) +
              Number(s.totalDinheiro) +
              Number(s.totalSuprimento) -
              Number(s.totalSangria),
          );

    const totalVendas = round2(
      Number(s.totalDinheiro) + Number(s.totalCartao) + Number(s.totalPix),
    );

    return {
      tipo: s.status === 'FECHADA' ? 'Z' : 'X',
      sessaoId: s.id,
      status: s.status,
      operador: s.operadorNome,
      filialId: s.filialId,
      abertaEm: s.abertaEm,
      fechadaEm: s.fechadaEm,
      saldoInicial: Number(s.saldoInicial),
      qtdVendas: s.qtdVendas,
      totalVendas,
      totalDinheiro: Number(s.totalDinheiro),
      totalCartao: Number(s.totalCartao),
      totalPix: Number(s.totalPix),
      totalSangria: Number(s.totalSangria),
      totalSuprimento: Number(s.totalSuprimento),
      dinheiroEsperadoGaveta: saldoCalculado,
      saldoFinalInformado: s.saldoFinalInformado != null ? Number(s.saldoFinalInformado) : null,
      diferenca: s.diferenca != null ? Number(s.diferenca) : null,
      cartaoInformado: s.cartaoInformado != null ? Number(s.cartaoInformado) : null,
      pixInformado: s.pixInformado != null ? Number(s.pixInformado) : null,
      diferencaCartao: s.diferencaCartao != null ? Number(s.diferencaCartao) : null,
      diferencaPix: s.diferencaPix != null ? Number(s.diferencaPix) : null,
    };
  }
}
