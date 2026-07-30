import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoPagoService } from './mercado-pago.service';
import { ProvisionamentoService } from './provisionamento.service';
import { EmailService } from './email.service';

/**
 * Orquestra o fluxo self-service de assinatura:
 *
 *   1. checkout(): valida o plano, provisiona o ambiente do cliente (empresa,
 *      filial, perfis e usuário dono) já em TRIAL, cria o preapproval no
 *      Mercado Pago e devolve o `initPoint` para o cliente cadastrar o cartão.
 *   2. processarWebhook(): o MP notifica mudanças de status da assinatura;
 *      espelhamos em Assinatura.status (authorized→ATIVA, paused→SUSPENSA,
 *      cancelled→CANCELADA).
 *
 * O objetivo é que o dono compre e já entre no sistema, sem intervenção manual.
 */
@Injectable()
export class AssinaturasService implements OnModuleInit {
  private readonly log = new Logger('Assinaturas');

  // Cache do catálogo de planos: muda raríssimo e é a 1ª query da landing.
  // Evita que o primeiro visitante pague a latência de conexão/compilação.
  private planosCache: any[] | null = null;
  private planosCacheEm = 0;
  private static readonly PLANOS_TTL_MS = 5 * 60 * 1000; // 5 min

  constructor(
    private prisma: PrismaService,
    private mp: MercadoPagoService,
    private provisionamento: ProvisionamentoService,
    private email: EmailService,
  ) {}

  /** Aquece a conexão/consulta de planos no boot, tirando o custo do 1º acesso. */
  async onModuleInit() {
    try {
      await this.listarPlanos();
      this.log.log('Catálogo de planos aquecido no boot.');
    } catch (e: any) {
      this.log.warn(`Não foi possível aquecer os planos no boot: ${e?.message || e}`);
    }
  }

  /** Catálogo público de planos ativos (página de preços) — servido de cache. */
  async listarPlanos() {
    const agora = Date.now();
    if (this.planosCache && agora - this.planosCacheEm < AssinaturasService.PLANOS_TTL_MS) {
      return this.planosCache;
    }
    const planos = await this.prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
      select: {
        id: true, codigo: true, nome: true, descricao: true, precoMensal: true,
        maxUsuarios: true, maxFiliais: true, maxPdvs: true, features: true, trialDias: true,
      },
    });
    this.planosCache = planos;
    this.planosCacheEm = agora;
    return planos;
  }

  /** Meses grátis concedidos no plano anual (paga 10, leva 12). */
  private static readonly MESES_GRATIS_ANUAL = 2;

  /**
   * Catálogo de add-ons de capacidade contratáveis no checkout. Cada unidade
   * amplia o limite do plano e é cobrada por mês (no anual, ganha os mesmos
   * meses grátis do bundle). `max` limita a quantidade por segurança.
   */
  private static readonly ADDONS = {
    pdvs: { codigo: 'pdvs', nome: 'Caixa (PDV) extra', precoMensal: 49, max: 20 },
    usuarios: { codigo: 'usuarios', nome: 'Usuário extra', precoMensal: 19, max: 50 },
    filiais: { codigo: 'filiais', nome: 'Filial extra', precoMensal: 89, max: 20 },
  } as const;

  /** Catálogo público de add-ons (para montar a etapa de capacidade no checkout). */
  listarAddons() {
    return Object.values(AssinaturasService.ADDONS).map((a) => ({
      codigo: a.codigo, nome: a.nome, precoMensal: a.precoMensal, max: a.max,
    }));
  }

  /** Normaliza as quantidades de add-ons vindas do checkout (>=0, inteiro, <=max). */
  private normalizarAddons(addons?: { pdvs?: number; usuarios?: number; filiais?: number }) {
    const clamp = (v: any, max: number) => {
      const n = Math.floor(Number(v) || 0);
      return Math.max(0, Math.min(max, n));
    };
    return {
      pdvs: clamp(addons?.pdvs, AssinaturasService.ADDONS.pdvs.max),
      usuarios: clamp(addons?.usuarios, AssinaturasService.ADDONS.usuarios.max),
      filiais: clamp(addons?.filiais, AssinaturasService.ADDONS.filiais.max),
    };
  }

  /** Soma mensal dos add-ons contratados (caixa/usuário/filial extra). */
  private addonsMensal(addons: { pdvs: number; usuarios: number; filiais: number }) {
    return (
      addons.pdvs * AssinaturasService.ADDONS.pdvs.precoMensal +
      addons.usuarios * AssinaturasService.ADDONS.usuarios.precoMensal +
      addons.filiais * AssinaturasService.ADDONS.filiais.precoMensal
    );
  }

  /** Valor do ciclo dado o preço-base mensal e o período (anual = 10 mensalidades). */
  private valorDoCiclo(baseMensal: number, periodo: string) {
    return periodo === 'anual'
      ? baseMensal * (12 - AssinaturasService.MESES_GRATIS_ANUAL)
      : baseMensal;
  }

  async checkout(input: {
    planoCodigo: string;
    periodo?: 'mensal' | 'anual';
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    adminNome: string;
    adminEmail: string;
    adminSenha: string;
    emailCobranca?: string;
    addons?: { pdvs?: number; usuarios?: number; filiais?: number };
  }): Promise<{ tenantId: string; assinaturaId: string; initPoint: string; simulado: boolean; periodo: string; valorCiclo: number }> {
    const plano = await this.prisma.plano.findUnique({ where: { codigo: input.planoCodigo } });
    if (!plano || !plano.ativo) throw new NotFoundException('Plano indisponível.');
    if (plano.codigo === 'ENTERPRISE') {
      throw new BadRequestException('O plano Enterprise é sob consulta. Fale com o time comercial.');
    }

    // Add-ons de capacidade contratados (caixa/usuário/filial extra).
    const addons = this.normalizarAddons(input.addons);
    const addonsMensal =
      addons.pdvs * AssinaturasService.ADDONS.pdvs.precoMensal +
      addons.usuarios * AssinaturasService.ADDONS.usuarios.precoMensal +
      addons.filiais * AssinaturasService.ADDONS.filiais.precoMensal;

    // Período de cobrança e valor do ciclo (anual = 10 mensalidades; add-ons entram no mesmo bundle).
    const periodo = input.periodo === 'anual' ? 'anual' : 'mensal';
    const baseMensal = Number(plano.precoMensal) + addonsMensal;
    const valorCiclo =
      periodo === 'anual'
        ? baseMensal * (12 - AssinaturasService.MESES_GRATIS_ANUAL)
        : baseMensal;

    // 1. Provisiona o ambiente (falha aqui = nada é criado; CNPJ duplicado → 409).
    const { tenantId } = await this.provisionamento.provisionarTenant({
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia,
      cnpj: input.cnpj,
      adminNome: input.adminNome,
      adminEmail: input.adminEmail,
      adminSenha: input.adminSenha,
    });

    // 2. Cria a assinatura em TRIAL.
    const trialAte = new Date(Date.now() + plano.trialDias * 24 * 60 * 60 * 1000);
    const assinatura = await this.prisma.assinatura.create({
      data: {
        tenantId,
        planoId: plano.id,
        status: 'TRIAL',
        periodo,
        emailCobranca: input.emailCobranca || input.adminEmail,
        trialAte,
        addonPdvs: addons.pdvs,
        addonUsuarios: addons.usuarios,
        addonFiliais: addons.filiais,
      },
    });

    // 3. Cria o preapproval no Mercado Pago (ou simulado).
    const frontUrl = (process.env.FRONT_URL || 'http://localhost:3013').replace(/\/$/, '');
    const totalAddons = addons.pdvs + addons.usuarios + addons.filiais;
    const pre = await this.mp.criarPreapproval({
      reason: `Assinatura ${plano.nome} ${periodo === 'anual' ? 'Anual' : 'Mensal'}${totalAddons > 0 ? ` + ${totalAddons} add-on(s)` : ''} - Lumin PDV`,
      valorCiclo,
      periodo,
      payerEmail: input.emailCobranca || input.adminEmail,
      externalReference: assinatura.id,
      backUrl: `${frontUrl}/assinatura/retorno`,
    });

    await this.prisma.assinatura.update({
      where: { id: assinatura.id },
      data: { mpPreapprovalId: pre.id },
    });

    // 4. E-mail de boas-vindas (não bloqueia o checkout se falhar).
    try {
      const r = await this.email.boasVindas({
        para: input.adminEmail,
        nome: input.adminNome,
        empresa: input.nomeFantasia || input.razaoSocial,
        plano: plano.nome,
        trialDias: plano.trialDias,
      });
      this.log.log(`Boas-vindas → ${input.adminEmail} (${r.simulado ? 'simulado' : 'enviado'})`);
    } catch (e: any) {
      this.log.error(`Falha no e-mail de boas-vindas para ${input.adminEmail}: ${e?.message || e}`);
    }

    this.log.log(`Checkout ${plano.codigo} (${periodo}, R$${valorCiclo}) → tenant ${tenantId}, assinatura ${assinatura.id}, MP ${pre.id}`);
    return { tenantId, assinaturaId: assinatura.id, initPoint: pre.initPoint, simulado: this.mp.simulado(), periodo, valorCiclo };
  }

  /**
   * Processa a notificação do Mercado Pago. Aceita tanto o corpo
   * `{ type, data: { id } }` quanto os query params (`topic`/`id`).
   */
  async processarWebhook(payload: { type?: string; action?: string; data?: { id?: string }; id?: string; topic?: string }) {
    const tipo = payload.type || payload.topic || '';
    const preapprovalId = payload.data?.id || payload.id;
    if (!preapprovalId) return { ok: true, ignorado: 'sem id' };
    // Só nos interessam eventos de assinatura (preapproval).
    if (tipo && !/preapproval|subscription/i.test(tipo)) return { ok: true, ignorado: tipo };

    const info = await this.mp.consultarPreapproval(String(preapprovalId));
    if (!info) return { ok: false, motivo: 'preapproval não encontrado no MP' };

    const assinatura = await this.prisma.assinatura.findFirst({
      where: { OR: [{ mpPreapprovalId: String(preapprovalId) }, { id: info.externalReference || '' }] },
    });
    if (!assinatura) return { ok: false, motivo: 'assinatura local não encontrada' };

    const novoStatus = this.mapearStatus(info.status);
    const dados: any = { status: novoStatus };
    if (novoStatus === 'ATIVA') {
      const dias = assinatura.periodo === 'anual' ? 365 : 30;
      dados.proximaCobranca = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    }
    if (novoStatus === 'CANCELADA') dados.canceladaEm = new Date();

    await this.prisma.assinatura.update({ where: { id: assinatura.id }, data: dados });
    // Mantém o flag simples do Tenant coerente (bloqueio de acesso).
    await this.prisma.tenant.update({
      where: { id: assinatura.tenantId },
      data: { ativo: novoStatus !== 'CANCELADA' },
    });

    this.log.log(`Webhook MP ${preapprovalId}: ${info.status} → ${novoStatus} (assinatura ${assinatura.id})`);
    return { ok: true, status: novoStatus };
  }

  private mapearStatus(mp: string): string {
    switch ((mp || '').toLowerCase()) {
      case 'authorized': return 'ATIVA';
      case 'paused': return 'SUSPENSA';
      case 'cancelled': return 'CANCELADA';
      default: return 'TRIAL'; // pending
    }
  }

  /** Situação da assinatura do tenant logado (para banners/onboarding no front). */
  async statusDoTenant(tenantId: string) {
    const a = await this.prisma.assinatura.findUnique({
      where: { tenantId },
      include: { plano: { select: { codigo: true, nome: true, precoMensal: true, features: true, maxUsuarios: true, maxFiliais: true, maxPdvs: true } } },
    });
    if (!a) return { assinado: false };
    // Limites efetivos = limites do plano + add-ons contratados.
    const somar = (base: number | null | undefined, extra: number) =>
      base == null ? null : base + extra;
    const limites = {
      maxUsuarios: somar(a.plano.maxUsuarios, a.addonUsuarios),
      maxFiliais: somar(a.plano.maxFiliais, a.addonFiliais),
      maxPdvs: somar(a.plano.maxPdvs, a.addonPdvs),
    };
    return {
      assinado: true,
      status: a.status,
      trialAte: a.trialAte,
      proximaCobranca: a.proximaCobranca,
      plano: a.plano,
      addons: { pdvs: a.addonPdvs, usuarios: a.addonUsuarios, filiais: a.addonFiliais },
      limites,
    };
  }

  /**
   * Upsell de capacidade no painel: o cliente já assinante ajusta a quantidade
   * de add-ons (caixa/usuário/filial extra). Recalcula o valor do ciclo,
   * atualiza o preapproval no Mercado Pago e grava as novas quantidades.
   *
   * As quantidades vêm ABSOLUTAS (o total desejado, não um delta) e são
   * normalizadas/limitadas antes de aplicar.
   */
  async alterarAddons(tenantId: string, addonsInput: { pdvs?: number; usuarios?: number; filiais?: number }) {
    const a = await this.prisma.assinatura.findUnique({
      where: { tenantId },
      include: { plano: { select: { precoMensal: true, maxUsuarios: true, maxFiliais: true, maxPdvs: true, nome: true, codigo: true } } },
    });
    if (!a) throw new NotFoundException('Nenhuma assinatura encontrada para este tenant.');
    if (a.status === 'CANCELADA') {
      throw new BadRequestException('Assinatura cancelada. Reative o plano antes de contratar add-ons.');
    }

    const addons = this.normalizarAddons(addonsInput);
    const baseMensal = Number(a.plano.precoMensal) + this.addonsMensal(addons);
    const valorCiclo = this.valorDoCiclo(baseMensal, a.periodo);

    // Atualiza o valor recorrente no Mercado Pago (simulado = no-op seguro).
    if (a.mpPreapprovalId) {
      await this.mp.atualizarValorPreapproval(a.mpPreapprovalId, valorCiclo);
    }

    await this.prisma.assinatura.update({
      where: { id: a.id },
      data: {
        addonPdvs: addons.pdvs,
        addonUsuarios: addons.usuarios,
        addonFiliais: addons.filiais,
      },
    });

    const somar = (base: number | null | undefined, extra: number) =>
      base == null ? null : base + extra;
    const limites = {
      maxUsuarios: somar(a.plano.maxUsuarios, addons.usuarios),
      maxFiliais: somar(a.plano.maxFiliais, addons.filiais),
      maxPdvs: somar(a.plano.maxPdvs, addons.pdvs),
    };

    this.log.log(`Add-ons alterados (tenant ${tenantId}): pdvs=${addons.pdvs} usuarios=${addons.usuarios} filiais=${addons.filiais} → R$${valorCiclo}/${a.periodo}`);
    return {
      ok: true,
      periodo: a.periodo,
      addons,
      limites,
      valorCiclo,
      simulado: this.mp.simulado(),
    };
  }
}
