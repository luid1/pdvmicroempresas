import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { removerOuInativar } from '../../common/utils/soft-delete.util';

@Injectable()
export class FornecedoresService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    const exists = await this.prisma.fornecedor.findFirst({ where: { tenantId, cnpj: dto.cnpj } });
    if (exists) throw new ConflictException('Fornecedor já cadastrado com este CPF/CNPJ.');
    return this.prisma.fornecedor.create({ data: { tenantId, ...this.sanitize(dto) } });
  }

  async findAll(tenantId: string, search?: string, tipoParceria?: string) {
    return this.prisma.fornecedor.findMany({
      where: {
        tenantId,
        ...(tipoParceria && { tipoParceria }),
        ...(search && {
          OR: [
            { razaoSocial: { contains: search, mode: 'insensitive' as any } },
            { nomeFantasia: { contains: search, mode: 'insensitive' as any } },
            { cnpj: { contains: search } },
            { localizacaoPropriedade: { contains: search, mode: 'insensitive' as any } },
          ],
        }),
      },
      orderBy: { razaoSocial: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const f = await this.prisma.fornecedor.findFirst({ where: { id, tenantId } });
    if (!f) throw new NotFoundException('Fornecedor não encontrado.');
    return f;
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    return this.prisma.fornecedor.update({ where: { id }, data: this.sanitize(dto) });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return removerOuInativar(
      () => this.prisma.fornecedor.delete({ where: { id } }),
      () => this.prisma.fornecedor.update({ where: { id }, data: { ativo: false } }),
    );
  }

  private sanitize(dto: any) {
    const out: any = { ...dto };
    delete out.id; delete out.tenantId; delete out.createdAt;
    if (out.prazoEntrega !== undefined) out.prazoEntrega = Number(out.prazoEntrega) || 1;
    if (out.endereco && out.enderecoJson === undefined) out.enderecoJson = out.endereco;
    if (!out.enderecoJson) out.enderecoJson = {};
    delete out.endereco;
    return out;
  }
}
