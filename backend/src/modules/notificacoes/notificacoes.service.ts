import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  Prisma,
  SeveridadeNotificacao,
  StatusFinanceiro,
  TipoNotificacao,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CriarNotificacaoDto } from './dto/notificacao.dto';

export interface NotifUserCtx {
  id: string;
  role?: string;
  permissoes?: string[];
}

interface EmitirArgs {
  tenantId: string;
  filialId?: string | null;
  usuarioId?: string | null;
  permissao?: string | null;
  tipo?: TipoNotificacao;
  severidade?: SeveridadeNotificacao;
  titulo: string;
  mensagem: string;
  link?: string | null;
  chaveDedup?: string | null;
}

const normalizarPerm = (p: string) => p.toUpperCase().replace(/\./g, ':').trim();

// Um dia em ms — usado nos cortes de data dos geradores.
const DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificacoesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacoesService.name);
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  // ───────────────────────── Scheduler dos geradores ─────────────────────────
  // Sem dependência de @nestjs/schedule: varre a cada 1h e ~40s após o boot.
  onModuleInit() {
    setTimeout(() => this.varrerSilencioso(), 40_000);
    this.timer = setInterval(() => this.varrerSilencioso(), 60 * 60 * 1000);
    this.timer.unref?.();
  }

  private async varrerSilencioso() {
    try {
      const r = await this.gerarAlertas();
      if (r.criadas > 0) this.logger.log(`Geradores de notificação criaram ${r.criadas} alerta(s).`);
    } catch (e) {
      this.logger.error('Falha ao gerar notificações automáticas', e as Error);
    }
  }

  // ───────────────────────── Emissão (uso interno + evento) ─────────────────────────

  /**
   * Cria uma notificação. Idempotente quando `chaveDedup` é informado
   * (@@unique tenant+chaveDedup) — re-execuções do gerador não duplicam.
   * Retorna a notificação criada, ou null se já existia (dedup).
   */
  async emitir(args: EmitirArgs) {
    try {
      return await this.prisma.notificacao.create({
        data: {
          tenantId: args.tenantId,
          filialId: args.filialId ?? null,
          usuarioId: args.usuarioId ?? null,
          permissao: args.permissao ? normalizarPerm(args.permissao) : null,
          tipo: args.tipo ?? TipoNotificacao.GENERICO,
          severidade: args.severidade ?? SeveridadeNotificacao.INFO,
          titulo: args.titulo,
          mensagem: args.mensagem,
          link: args.link ?? null,
          chaveDedup: args.chaveDedup ?? null,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return null; // já existe (dedup)
      throw e;
    }
  }

  async criar(tenantId: string, dto: CriarNotificacaoDto) {
    return this.emitir({ tenantId, ...dto });
  }

  // ───────────────────────── Consulta (sino) ─────────────────────────

  private whereParaUsuario(tenantId: string, user: NotifUserCtx): Prisma.NotificacaoWhereInput {
    const isAdmin = (user.role || '').toUpperCase() === 'ADMIN';
    const permsUsuario = (user.permissoes || []).map(normalizarPerm);
    const broadcast: Prisma.NotificacaoWhereInput = {
      usuarioId: null,
      ...(isAdmin
        ? {}
        : { OR: [{ permissao: null }, { permissao: { in: permsUsuario } }] }),
    };
    return { tenantId, OR: [{ usuarioId: user.id }, broadcast] };
  }

  async listar(
    tenantId: string,
    user: NotifUserCtx,
    opts: { apenasNaoLidas?: boolean; limit?: number } = {},
  ) {
    const where = this.whereParaUsuario(tenantId, user);
    const rows = await this.prisma.notificacao.findMany({
      where: opts.apenasNaoLidas ? { ...where, lida: false } : where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 50, 200),
    });
    return rows;
  }

  async contarNaoLidas(tenantId: string, user: NotifUserCtx) {
    const where = this.whereParaUsuario(tenantId, user);
    const total = await this.prisma.notificacao.count({ where: { ...where, lida: false } });
    return { naoLidas: total };
  }

  async marcarLida(tenantId: string, user: NotifUserCtx, id: string) {
    const n = await this.prisma.notificacao.findFirst({ where: { id, tenantId } });
    if (!n) throw new NotFoundException('Notificação não encontrada.');
    await this.prisma.notificacao.update({
      where: { id },
      data: { lida: true, lidaEm: new Date() },
    });
    return { ok: true };
  }

  async marcarTodasLidas(tenantId: string, user: NotifUserCtx) {
    const where = this.whereParaUsuario(tenantId, user);
    const r = await this.prisma.notificacao.updateMany({
      where: { ...where, lida: false },
      data: { lida: true, lidaEm: new Date() },
    });
    return { atualizadas: r.count };
  }

  async remover(tenantId: string, id: string) {
    await this.prisma.notificacao.deleteMany({ where: { id, tenantId } });
    return { ok: true };
  }

  // ───────────────────────── Geradores automáticos ─────────────────────────

  /**
   * Varre as fontes de alerta e emite notificações in-app (idempotentes).
   * Pode ser disparado manualmente (POST /notificacoes/gerar) ou pelo scheduler.
   * `tenantId` opcional: se ausente, roda para todos os tenants com dados.
   */
  async gerarAlertas(tenantId?: string) {
    const tenants = tenantId
      ? [tenantId]
      : (
          await this.prisma.tenant.findMany({ select: { id: true } })
        ).map((t) => t.id);

    let criadas = 0;
    for (const tid of tenants) {
      criadas += await this.gerarTitulosPagar(tid);
      criadas += await this.gerarTitulosReceber(tid);
      criadas += await this.gerarEstoqueMinimo(tid);
      criadas += await this.gerarValidadeProxima(tid);
    }
    return { criadas };
  }

  private hojeCorte() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
  }

  private async gerarTitulosPagar(tenantId: string): Promise<number> {
    const hoje = this.hojeCorte();
    const limite = new Date(hoje.getTime() + 3 * DIA); // vence em até 3 dias
    const contas = await this.prisma.contaPagar.findMany({
      where: {
        tenantId,
        status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL, StatusFinanceiro.VENCIDO] },
        dataVencimento: { lte: limite },
      },
      select: { id: true, descricao: true, dataVencimento: true, filialId: true },
      take: 500,
    });
    let n = 0;
    for (const c of contas) {
      const venc = new Date(c.dataVencimento);
      const vencido = venc < hoje;
      const criada = await this.emitir({
        tenantId,
        filialId: c.filialId,
        permissao: 'FINANCEIRO:OPERAR',
        tipo: TipoNotificacao.TITULO_A_PAGAR,
        severidade: vencido ? SeveridadeNotificacao.CRITICO : SeveridadeNotificacao.AVISO,
        titulo: vencido ? 'Conta a pagar vencida' : 'Conta a pagar vencendo',
        mensagem: `${c.descricao} — vence ${venc.toLocaleDateString('pt-BR')}.`,
        link: '/financeiro/pagar',
        chaveDedup: `TITULO_A_PAGAR:${c.id}:${venc.toISOString().slice(0, 10)}`,
      });
      if (criada) n += 1;
    }
    return n;
  }

  private async gerarTitulosReceber(tenantId: string): Promise<number> {
    const hoje = this.hojeCorte();
    const limite = new Date(hoje.getTime() + 3 * DIA);
    const contas = await this.prisma.contaReceber.findMany({
      where: {
        tenantId,
        status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL, StatusFinanceiro.VENCIDO] },
        dataVencimento: { lte: limite },
      },
      select: { id: true, descricao: true, dataVencimento: true, filialId: true },
      take: 500,
    });
    let n = 0;
    for (const c of contas) {
      const venc = new Date(c.dataVencimento);
      const vencido = venc < hoje;
      const criada = await this.emitir({
        tenantId,
        filialId: c.filialId,
        permissao: 'FINANCEIRO:OPERAR',
        tipo: TipoNotificacao.TITULO_A_RECEBER,
        severidade: vencido ? SeveridadeNotificacao.CRITICO : SeveridadeNotificacao.INFO,
        titulo: vencido ? 'Título a receber vencido' : 'Título a receber vencendo',
        mensagem: `${c.descricao} — vence ${venc.toLocaleDateString('pt-BR')}.`,
        link: '/financeiro/receber',
        chaveDedup: `TITULO_A_RECEBER:${c.id}:${venc.toISOString().slice(0, 10)}`,
      });
      if (criada) n += 1;
    }
    return n;
  }

  private async gerarEstoqueMinimo(tenantId: string): Promise<number> {
    // Agrega o saldo por produto e compara com o estoqueMinimo do produto.
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, ativo: true, estoqueMinimo: { gt: 0 } },
      select: { id: true, descricao: true, codigo: true, estoqueMinimo: true },
      take: 2000,
    });
    if (produtos.length === 0) return 0;

    const saldos = await this.prisma.estoqueSaldo.groupBy({
      by: ['produtoId'],
      where: { tenantId, produtoId: { in: produtos.map((p) => p.id) } },
      _sum: { quantidade: true },
    });
    const mapaSaldo = new Map(saldos.map((s) => [s.produtoId, Number(s._sum.quantidade ?? 0)]));
    const hojeKey = this.hojeCorte().toISOString().slice(0, 10);

    let n = 0;
    for (const p of produtos) {
      const saldo = mapaSaldo.get(p.id) ?? 0;
      const min = Number(p.estoqueMinimo);
      if (saldo >= min) continue;
      const criada = await this.emitir({
        tenantId,
        permissao: 'ESTOQUE:OPERAR',
        tipo: TipoNotificacao.ESTOQUE_MINIMO,
        severidade: saldo <= 0 ? SeveridadeNotificacao.CRITICO : SeveridadeNotificacao.AVISO,
        titulo: saldo <= 0 ? 'Produto sem estoque' : 'Estoque abaixo do mínimo',
        mensagem: `${p.descricao}${p.codigo ? ` (${p.codigo})` : ''} — saldo ${saldo} / mínimo ${min}.`,
        link: '/wms/posicao',
        // dedup por dia: um alerta por produto por dia (evita spam a cada varredura)
        chaveDedup: `ESTOQUE_MINIMO:${p.id}:${hojeKey}`,
      });
      if (criada) n += 1;
    }
    return n;
  }

  private async gerarValidadeProxima(tenantId: string): Promise<number> {
    const hoje = this.hojeCorte();
    const limite = new Date(hoje.getTime() + 15 * DIA); // vence em até 15 dias
    const lotes = await this.prisma.lote.findMany({
      where: {
        tenantId,
        dataValidade: { not: null, lte: limite },
      },
      select: { id: true, numero: true, dataValidade: true, produtoId: true },
      take: 1000,
    });
    if (lotes.length === 0) return 0;

    // Só alerta lotes que ainda têm saldo em estoque.
    const saldos = await this.prisma.estoqueSaldo.groupBy({
      by: ['loteId'],
      where: { tenantId, loteId: { in: lotes.map((l) => l.id) } },
      _sum: { quantidade: true },
    });
    const comSaldo = new Set(
      saldos.filter((s) => Number(s._sum.quantidade ?? 0) > 0).map((s) => s.loteId),
    );

    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: lotes.map((l) => l.produtoId) } },
      select: { id: true, descricao: true },
    });
    const nomeProduto = new Map(produtos.map((p) => [p.id, p.descricao]));

    let n = 0;
    for (const l of lotes) {
      if (!l.dataValidade || !comSaldo.has(l.id)) continue;
      const val = new Date(l.dataValidade);
      const vencido = val < hoje;
      const criada = await this.emitir({
        tenantId,
        permissao: 'ESTOQUE:OPERAR',
        tipo: TipoNotificacao.VALIDADE_PROXIMA,
        severidade: vencido ? SeveridadeNotificacao.CRITICO : SeveridadeNotificacao.AVISO,
        titulo: vencido ? 'Lote vencido em estoque' : 'Validade próxima',
        mensagem: `${nomeProduto.get(l.produtoId) ?? 'Produto'} — lote ${l.numero ?? l.id.slice(0, 8)} vence ${val.toLocaleDateString('pt-BR')}.`,
        link: '/wms/pereciveis',
        chaveDedup: `VALIDADE_PROXIMA:${l.id}:${val.toISOString().slice(0, 10)}`,
      });
      if (criada) n += 1;
    }
    return n;
  }
}
