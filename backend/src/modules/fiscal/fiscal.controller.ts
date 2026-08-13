import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { FiscalService } from './fiscal.service';
import { CurrentTenant } from '../../common/decorators/context.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRegraFiscalDto, UpdateRegraFiscalDto } from './dto/regra-fiscal.dto';

@ApiTags('Fiscal')
@ApiBearerAuth()
@Controller('fiscal')
export class FiscalController {
  constructor(
    private service: FiscalService,
    private prisma: PrismaService,
  ) {}

  // ---- Matriz fiscal (CRUD) ----
  @Get('regras')
  @ApiOperation({ summary: 'Lista as regras da matriz fiscal' })
  listar(@CurrentTenant() tenantId: string) {
    return this.service.listarRegras(tenantId);
  }

  @Post('regras')
  @ApiOperation({ summary: 'Cria uma regra fiscal' })
  criar(@CurrentTenant() tenantId: string, @Body() dto: CreateRegraFiscalDto) {
    return this.service.criarRegra(tenantId, dto);
  }

  @Post('regras/seed')
  @ApiOperation({ summary: 'Semeia regras-padrão (FLV/Simples) se a matriz estiver vazia' })
  seed(@CurrentTenant() tenantId: string) {
    return this.service.seedPadrao(tenantId);
  }

  @Put('regras/:id')
  @ApiOperation({ summary: 'Atualiza uma regra fiscal' })
  atualizar(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRegraFiscalDto) {
    return this.service.atualizarRegra(tenantId, id, dto);
  }

  @Delete('regras/:id')
  @ApiOperation({ summary: 'Remove uma regra fiscal' })
  remover(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.removerRegra(tenantId, id);
  }

  // ---- Validação anti-erro ----
  @Get('validar/:pedidoId')
  @ApiOperation({ summary: 'Checklist anti-erro antes de faturar um pedido' })
  validar(@CurrentTenant() tenantId: string, @Param('pedidoId') pedidoId: string) {
    return this.service.validarFaturamento(tenantId, pedidoId);
  }

  // ---- Preview de impostos ----
  @Get('preview/:pedidoId')
  @ApiOperation({ summary: 'Pré-visualiza os impostos calculados para um pedido' })
  async preview(@CurrentTenant() tenantId: string, @Param('pedidoId') pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId },
      include: { cliente: true, filialOrigem: true, itens: { include: { produto: true } } },
    });
    if (!pedido) return { erro: 'Pedido não encontrado.' };
    const calc = await this.service.calcularPedido(tenantId, pedido);
    return {
      contexto: calc.contexto,
      totais: calc.totais,
      itens: calc.itens.map(({ item, imposto }) => ({
        descricao: item.descricao,
        ncm: item.produto?.ncm,
        quantidade: item.quantidade,
        valorTotal: item.valorTotal,
        ...imposto,
      })),
    };
  }
}
