import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StatusPedido, StatusFinanceiro } from '@prisma/client';

/**
 * MÓDULO FISCAL CENTRALIZADO — Reforma Tributária (EC 132/2023 · IBS + CBS)
 *
 * Responsável por:
 *  1. Calcular IBS/CBS de uma venda a partir do NCM + tipo de alíquota do produto;
 *  2. Faturar um pedido: cálculo fiscal + transmissão simulada do XML à mensageria
 *     (FocusNFe/PlugNotas) + gravação dos impostos + geração automática de
 *     3 lançamentos financeiros (Receita bruta, Provisão IBS, Provisão CBS);
 *  3. Devolver uma venda: estorno da NF-e (simulado), anulação do contas a receber,
 *     cancelamento das provisões de impostos e trilha completa de auditoria.
 *
 * Alíquotas determinísticas (simulação da Reforma):
 *  - PADRAO:   26,5%  (IBS 17,7% + CBS 8,8%)
 *  - REDUZIDA: 10,6%  (IBS  7,1% + CBS 3,5%)
 *  - ISENTA:    0,0%
 *  - SELETIVA: usa a alíquota PADRAO como base (o Imposto Seletivo adicional
 *              depende de regulamentação específica por produto — flag no retorno).
 */

/** Arredonda para 2 casas decimais (padrão monetário). */
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

type TipoAliquota = 'PADRAO' | 'REDUZIDA' | 'ISENTA' | 'SELETIVA';

interface AliquotaReforma {
  ibs: number; // %
  cbs: number; // %
  total: number; // %
  seletiva: boolean;
}

const TABELA_REFORMA: Record<TipoAliquota, AliquotaReforma> = {
  PADRAO: { ibs: 17.7, cbs: 8.8, total: 26.5, seletiva: false },
  REDUZIDA: { ibs: 7.1, cbs: 3.5, total: 10.6, seletiva: false },
  ISENTA: { ibs: 0, cbs: 0, total: 0, seletiva: false },
  SELETIVA: { ibs: 17.7, cbs: 8.8, total: 26.5, seletiva: true },
};

interface ItemCalculoDto {
  produto_id: string;
  quantidade: number;
  preco_unitario?: number; // opcional — se ausente, usa o preço do pedido/cadastro
}

@Injectable()
export class FiscalReformaService {
  private readonly logger = new Logger(FiscalReformaService.name);

  constructor(private prisma: PrismaService) {}

  /* ──────────────────────────────────────────────────────────────────────────
     Resolve a alíquota da Reforma para um produto (com validação do NCM).
     ────────────────────────────────────────────────────────────────────────── */
  private resolverAliquota(produto: { ncm: string | null; tipoAliquotaReforma: string | null }): {
    aliquota: AliquotaReforma;
    tipo: TipoAliquota;
    ncmValido: boolean;
  } {
    const tipo = (String(produto.tipoAliquotaReforma || 'PADRAO').toUpperCase() as TipoAliquota) in TABELA_REFORMA
      ? (String(produto.tipoAliquotaReforma || 'PADRAO').toUpperCase() as TipoAliquota)
      : 'PADRAO';
    const ncmValido = /^\d{8}$/.test(String(produto.ncm || '').replace(/\D/g, ''));
    return { aliquota: TABELA_REFORMA[tipo], tipo, ncmValido };
  }

  /* ──────────────────────────────────────────────────────────────────────────
     1) POST /fiscal-reforma/calcular-venda
     Recebe itens [{ produto_id, quantidade, preco_unitario? }] e devolve o
     cálculo detalhado de IBS/CBS item a item + consolidado.
     ────────────────────────────────────────────────────────────────────────── */
  async calcularVenda(tenantId: string, itens: ItemCalculoDto[]) {
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new BadRequestException('Informe ao menos um item com produto_id e quantidade.');
    }

    try {
      const detalhes: any[] = [];
      let totalBruto = 0;
      let totalIbs = 0;
      let totalCbs = 0;

      for (const item of itens) {
        const quantidade = Number(item.quantidade) || 0;
        if (!item.produto_id) throw new BadRequestException('Item sem produto_id.');
        if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');

        const produto = await this.prisma.produto.findFirst({
          where: { id: item.produto_id, tenantId },
          select: {
            id: true,
            codigo: true,
            descricao: true,
            ncm: true,
            tipoAliquotaReforma: true,
            confiancaIa: true,
            precoVenda: true,
          } as any,
        });
        if (!produto) throw new NotFoundException(`Produto ${item.produto_id} não encontrado.`);

        const precoUnitario = Number(item.preco_unitario ?? (produto as any).precoVenda ?? 0);
        const { aliquota, tipo, ncmValido } = this.resolverAliquota(produto as any);

        const valorBrutoItem = r2(quantidade * precoUnitario);
        const ibsCalculado = r2(valorBrutoItem * (aliquota.ibs / 100));
        const cbsCalculado = r2(valorBrutoItem * (aliquota.cbs / 100));

        totalBruto = r2(totalBruto + valorBrutoItem);
        totalIbs = r2(totalIbs + ibsCalculado);
        totalCbs = r2(totalCbs + cbsCalculado);

        detalhes.push({
          produto_id: produto.id,
          codigo: (produto as any).codigo,
          descricao: (produto as any).descricao,
          ncm_aplicado: (produto as any).ncm,
          ncm_valido: ncmValido,
          tipo_aliquota_reforma: tipo,
          confianca_ia: Number((produto as any).confiancaIa || 0),
          aliquota_ibs_pct: aliquota.ibs,
          aliquota_cbs_pct: aliquota.cbs,
          aliquota_total_pct: aliquota.total,
          imposto_seletivo_pendente: aliquota.seletiva,
          quantidade,
          preco_unitario: r2(precoUnitario),
          valor_bruto: valorBrutoItem,
          ibs_calculado: ibsCalculado,
          cbs_calculado: cbsCalculado,
          total_impostos: r2(ibsCalculado + cbsCalculado),
        });
      }

      return {
        itens: detalhes,
        consolidado: {
          valor_bruto: totalBruto,
          valor_ibs: totalIbs,
          valor_cbs: totalCbs,
          total_impostos: r2(totalIbs + totalCbs),
          valor_liquido: r2(totalBruto - totalIbs - totalCbs),
          carga_efetiva_pct: totalBruto > 0 ? r2(((totalIbs + totalCbs) / totalBruto) * 100) : 0,
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      this.logger.error(`Falha no cálculo fiscal: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Falha ao calcular os impostos da venda.');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     Simula a transmissão do XML da NF-e a uma API de mensageria
     (FocusNFe / PlugNotas). Retorna número da nota + chave de acesso.
     ────────────────────────────────────────────────────────────────────────── */
  private async transmitirNfeSimulado(payload: {
    pedidoNumero: number;
    valorTotal: number;
    finalidade: 'NORMAL' | 'DEVOLUCAO';
  }): Promise<{ numero_nota: string; chave_acesso: string; protocolo: string; status: string }> {
    try {
      // Simulação determinística: chave de 44 dígitos (UF 35=SP + AAMM + CNPJ fake + modelo/série/número + aleatório)
      const agora = new Date();
      const aamm = `${String(agora.getFullYear()).slice(2)}${String(agora.getMonth() + 1).padStart(2, '0')}`;
      const numero = String(payload.pedidoNumero).padStart(9, '0');
      const aleatorio = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
      const chave = `35${aamm}12345678000199${payload.finalidade === 'DEVOLUCAO' ? '65' : '55'}001${numero}1${aleatorio}`.slice(0, 43);
      const dv = String(chave.split('').reduce((s, c) => s + Number(c), 0) % 10);

      // Latência simulada da mensageria
      await new Promise((res) => setTimeout(res, 150));

      return {
        numero_nota: numero,
        chave_acesso: `${chave}${dv}`,
        protocolo: `135${Date.now()}`,
        status: 'AUTORIZADA',
      };
    } catch (err) {
      this.logger.error(`Falha na transmissão simulada: ${(err as Error).message}`);
      throw new InternalServerErrorException('Falha na comunicação com a mensageria fiscal.');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     2) POST /fiscal-reforma/faturar
     Fatura um pedido existente: cálculo fiscal → NF-e (simulada) → grava
     impostos → 3 lançamentos financeiros automáticos → auditoria.
     ────────────────────────────────────────────────────────────────────────── */
  async faturar(tenantId: string, usuarioId: string, dto: { pedido_id: string; data_vencimento?: string }) {
    if (!dto?.pedido_id) throw new BadRequestException('Informe o pedido_id.');

    try {
      const pedido = await this.prisma.pedido.findFirst({
        where: { id: dto.pedido_id, tenantId },
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          itens: { include: { produto: { select: { id: true, ncm: true, tipoAliquotaReforma: true, descricao: true } as any } } },
        },
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');
      if (pedido.status === 'FATURADO') throw new BadRequestException('Pedido já foi faturado.');
      if (pedido.status === 'CANCELADO' || pedido.status === 'DEVOLVIDO') {
        throw new BadRequestException(`Pedido ${pedido.status} não pode ser faturado.`);
      }
      if (!pedido.itens.length) throw new BadRequestException('Pedido sem itens.');

      // 1. Cálculo fiscal item a item (IBS/CBS)
      const calculo = await this.calcularVenda(
        tenantId,
        pedido.itens.map((i) => ({
          produto_id: i.produtoId,
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.precoUnitario),
        })),
      );

      // 2. Transmissão do XML (simulada — FocusNFe/PlugNotas)
      const nfe = await this.transmitirNfeSimulado({
        pedidoNumero: pedido.numero,
        valorTotal: calculo.consolidado.valor_bruto,
        finalidade: 'NORMAL',
      });

      const vencimento = dto.data_vencimento ? new Date(dto.data_vencimento) : new Date(Date.now() + 30 * 86400000);
      const nomeCliente = pedido.cliente?.nomeFantasia || pedido.cliente?.razaoSocial || 'Cliente';

      // 3. Persistência atômica: pedido + itens + 3 lançamentos + auditoria
      const resultado = await this.prisma.$transaction(async (tx) => {
        // 3a. Impostos por item
        for (const item of pedido.itens) {
          const det = calculo.itens.find((d: any) => d.produto_id === item.produtoId);
          if (!det) continue;
          await tx.itemPedido.update({
            where: { id: item.id },
            data: {
              ncmAplicado: det.ncm_aplicado,
              ibsCalculado: det.ibs_calculado,
              cbsCalculado: det.cbs_calculado,
            } as any,
          });
        }

        // 3b. Cabeçalho do pedido
        const pedidoAtualizado = await tx.pedido.update({
          where: { id: pedido.id },
          data: {
            status: StatusPedido.FATURADO,
            valorIbs: calculo.consolidado.valor_ibs,
            valorCbs: calculo.consolidado.valor_cbs,
            chaveAcessoNfe: nfe.chave_acesso,
            numeroNfe: nfe.numero_nota,
          } as any,
        });

        // 3c-i. RECEITA — Contas a Receber pelo valor bruto
        const receita = await tx.contaReceber.create({
          data: {
            tenantId,
            filialId: pedido.filialOrigemId,
            clienteId: pedido.clienteId,
            pedidoId: pedido.id,
            descricao: `Venda — Pedido #${pedido.numero} · NF-e ${nfe.numero_nota} · ${nomeCliente}`,
            numero: `PED-${pedido.numero}`,
            valorOriginal: calculo.consolidado.valor_bruto,
            dataVencimento: vencimento,
            status: StatusFinanceiro.ABERTO,
          },
        });

        // 3c-ii. PROVISÃO IBS — Contas a Pagar (governo)
        const provisaoIbs = await tx.contaPagar.create({
          data: {
            tenantId,
            filialId: pedido.filialOrigemId,
            descricao: `Provisão IBS — Pedido #${pedido.numero} · NF-e ${nfe.numero_nota}`,
            numero: `IBS-${pedido.numero}`,
            valorOriginal: calculo.consolidado.valor_ibs,
            dataVencimento: vencimento,
            status: StatusFinanceiro.ABERTO,
            observacoes: `PROVISAO_IMPOSTO;REF_PEDIDO:${pedido.id}`,
          },
        });

        // 3c-iii. PROVISÃO CBS — Contas a Pagar (governo)
        const provisaoCbs = await tx.contaPagar.create({
          data: {
            tenantId,
            filialId: pedido.filialOrigemId,
            descricao: `Provisão CBS — Pedido #${pedido.numero} · NF-e ${nfe.numero_nota}`,
            numero: `CBS-${pedido.numero}`,
            valorOriginal: calculo.consolidado.valor_cbs,
            dataVencimento: vencimento,
            status: StatusFinanceiro.ABERTO,
            observacoes: `PROVISAO_IMPOSTO;REF_PEDIDO:${pedido.id}`,
          },
        });

        // 3d. Auditoria fiscal — emissão
        await tx.auditLog.create({
          data: {
            tenantId,
            usuarioId,
            modulo: 'FISCAL_REFORMA',
            acao: 'EMITIR',
            entidade: 'Pedido',
            entidadeId: pedido.id,
            dadosAntes: { status: pedido.status, valorIbs: 0, valorCbs: 0 },
            dadosDepois: {
              status: 'FATURADO',
              valorIbs: calculo.consolidado.valor_ibs,
              valorCbs: calculo.consolidado.valor_cbs,
              numeroNfe: nfe.numero_nota,
              chaveAcesso: nfe.chave_acesso,
              protocolo: nfe.protocolo,
            },
          },
        });

        return { pedidoAtualizado, receita, provisaoIbs, provisaoCbs };
      });

      return {
        sucesso: true,
        pedido_id: pedido.id,
        status: 'FATURADO',
        nfe,
        fiscal: calculo.consolidado,
        lancamentos: {
          receita: { id: resultado.receita.id, valor: Number(resultado.receita.valorOriginal) },
          provisao_ibs: { id: resultado.provisaoIbs.id, valor: Number(resultado.provisaoIbs.valorOriginal) },
          provisao_cbs: { id: resultado.provisaoCbs.id, valor: Number(resultado.provisaoCbs.valorOriginal) },
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      this.logger.error(`Falha no faturamento: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Falha ao faturar a venda.');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     3) POST /fiscal-reforma/devolver
     Devolução: NF-e de estorno (simulada) + anula contas a receber + cancela
     provisões IBS/CBS + auditoria fiscal completa (antes/depois).
     ────────────────────────────────────────────────────────────────────────── */
  async devolver(tenantId: string, usuarioId: string, dto: { pedido_id: string; motivo?: string }) {
    if (!dto?.pedido_id) throw new BadRequestException('Informe o pedido_id.');

    try {
      const pedido = await this.prisma.pedido.findFirst({
        where: { id: dto.pedido_id, tenantId },
        include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');
      if (pedido.status === 'DEVOLVIDO') throw new BadRequestException('Pedido já foi devolvido.');
      if (pedido.status !== 'FATURADO' && pedido.status !== 'ENTREGUE') {
        throw new BadRequestException(`Somente pedidos FATURADOS ou ENTREGUES podem ser devolvidos (status atual: ${pedido.status}).`);
      }

      // NF-e de devolução (estorno) — simulada
      const nfeDevolucao = await this.transmitirNfeSimulado({
        pedidoNumero: pedido.numero,
        valorTotal: Number(pedido.valorTotal),
        finalidade: 'DEVOLUCAO',
      });

      const resultado = await this.prisma.$transaction(async (tx) => {
        // 1. Status do pedido
        const pedidoAtualizado = await tx.pedido.update({
          where: { id: pedido.id },
          data: { status: StatusPedido.DEVOLVIDO },
        });

        // 2. Anula o contas a receber vinculado (lançamento inverso via cancelamento)
        const receitas = await tx.contaReceber.findMany({
          where: { tenantId, pedidoId: pedido.id, status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL, StatusFinanceiro.VENCIDO] } },
        });
        for (const r of receitas) {
          await tx.contaReceber.update({
            where: { id: r.id },
            data: { status: StatusFinanceiro.CANCELADO, observacoes: `Anulado por devolução — NF-e ${nfeDevolucao.numero_nota}` },
          });
        }

        // 3. Cancela as provisões de impostos (IBS/CBS) geradas no faturamento
        const provisoes = await tx.contaPagar.findMany({
          where: {
            tenantId,
            observacoes: { contains: `REF_PEDIDO:${pedido.id}` },
            status: { in: [StatusFinanceiro.ABERTO, StatusFinanceiro.PARCIAL, StatusFinanceiro.VENCIDO] },
          },
        });
        for (const p of provisoes) {
          await tx.contaPagar.update({
            where: { id: p.id },
            data: { status: StatusFinanceiro.CANCELADO, observacoes: `${p.observacoes};CANCELADA_POR_DEVOLUCAO:${nfeDevolucao.numero_nota}` },
          });
        }

        // 4. Auditoria fiscal — estorno
        await tx.auditLog.create({
          data: {
            tenantId,
            usuarioId,
            modulo: 'FISCAL_REFORMA',
            acao: 'ESTORNO',
            entidade: 'Pedido',
            entidadeId: pedido.id,
            dadosAntes: {
              status: pedido.status,
              valorIbs: Number((pedido as any).valorIbs || 0),
              valorCbs: Number((pedido as any).valorCbs || 0),
              receitasAtivas: receitas.map((r) => ({ id: r.id, valor: Number(r.valorOriginal) })),
              provisoesAtivas: provisoes.map((p) => ({ id: p.id, numero: p.numero, valor: Number(p.valorOriginal) })),
            },
            dadosDepois: {
              status: 'DEVOLVIDO',
              motivo: dto.motivo || null,
              nfeDevolucao: nfeDevolucao.numero_nota,
              chaveAcesso: nfeDevolucao.chave_acesso,
              receitasCanceladas: receitas.length,
              provisoesCanceladas: provisoes.length,
            },
          },
        });

        return { pedidoAtualizado, receitasCanceladas: receitas.length, provisoesCanceladas: provisoes.length };
      });

      return {
        sucesso: true,
        pedido_id: pedido.id,
        status: 'DEVOLVIDO',
        nfe_devolucao: nfeDevolucao,
        financeiro: {
          contas_receber_anuladas: resultado.receitasCanceladas,
          provisoes_impostos_canceladas: resultado.provisoesCanceladas,
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      this.logger.error(`Falha na devolução: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Falha ao processar a devolução da venda.');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     4) GET /fiscal-reforma/auditoria — trilha fiscal (emissões, estornos,
     alterações de NCM) para a tela de auditoria.
     ────────────────────────────────────────────────────────────────────────── */
  async auditoria(tenantId: string, limite = 100) {
    try {
      return await this.prisma.auditLog.findMany({
        where: { tenantId, modulo: 'FISCAL_REFORMA' },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limite) || 100, 500),
        include: { usuario: { select: { nome: true } } },
      });
    } catch (err) {
      this.logger.error(`Falha ao listar auditoria fiscal: ${(err as Error).message}`);
      throw new InternalServerErrorException('Falha ao consultar a auditoria fiscal.');
    }
  }
}
