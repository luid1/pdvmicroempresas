import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { removerOuInativar } from '../../common/utils/soft-delete.util';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any) {
    const exists = await this.prisma.cliente.findUnique({
      where: { tenantId_cnpjCpf: { tenantId, cnpjCpf: dto.cnpjCpf } },
    });
    if (exists) throw new ConflictException('Cliente já cadastrado.');

    return this.prisma.cliente.create({ data: { tenantId, ...dto } });
  }

  async findAll(tenantId: string, search?: string) {
    return this.prisma.cliente.findMany({
      where: {
        tenantId,
        ...(search && {
          OR: [
            { razaoSocial: { contains: search, mode: 'insensitive' as any } },
            { nomeFantasia: { contains: search, mode: 'insensitive' as any } },
            { cnpjCpf: { contains: search } },
          ],
        }),
      },
      orderBy: { razaoSocial: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return c;
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return removerOuInativar(
      () => this.prisma.cliente.delete({ where: { id } }),
      () => this.prisma.cliente.update({ where: { id }, data: { ativo: false } }),
    );
  }
}
