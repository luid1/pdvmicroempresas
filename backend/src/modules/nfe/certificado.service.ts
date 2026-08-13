import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * CRUD de certificados digitais A1 (Frente F.2).
 *
 * SEGURANÇA:
 *  - A senha do .pfx NUNCA é persistida em claro. Ciframos com AES-256-GCM usando
 *    a chave `CERT_ENC_KEY` (env). Se a chave não estiver definida, o cadastro é
 *    recusado — preferimos falhar a guardar segredo desprotegido.
 *  - A senha decifrada só é exposta internamente (uso do provider real), nunca em API.
 */
@Injectable()
export class CertificadoService {
  private readonly logger = new Logger(CertificadoService.name);

  constructor(private prisma: PrismaService) {}

  private getKey(): Buffer {
    const raw = process.env.CERT_ENC_KEY || '';
    if (!raw || raw.length < 16) {
      throw new BadRequestException(
        'CERT_ENC_KEY não configurada (mín. 16 chars). Defina-a para cadastrar certificados com segurança.',
      );
    }
    // Deriva 32 bytes determinísticos da chave informada.
    return crypto.createHash('sha256').update(raw).digest();
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  /** Uso interno (provider real). Não expor via API. */
  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = (payload || '').split(':');
    if (!ivB64 || !tagB64 || !dataB64) throw new BadRequestException('Senha cifrada inválida.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }

  /** Remove campos sensíveis antes de devolver ao cliente. */
  private safe(c: any) {
    if (!c) return c;
    const { senhaCriptografada, arquivo, ...rest } = c;
    return { ...rest, temArquivo: !!arquivo };
  }

  async listar(tenantId: string) {
    const rows = await this.prisma.certificadoDigital.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => this.safe(c));
  }

  async criar(
    tenantId: string,
    dto: {
      nome: string;
      arquivo: string;
      senha: string;
      filialId?: string;
      cnpj?: string;
      validoDe?: string;
      validoAte?: string;
      tipo?: string;
    },
  ) {
    if (!dto?.nome?.trim()) throw new BadRequestException('Nome do certificado é obrigatório.');
    if (!dto?.arquivo) throw new BadRequestException('Arquivo (.pfx) é obrigatório.');
    if (!dto?.senha) throw new BadRequestException('Senha do certificado é obrigatória.');

    const created = await this.prisma.certificadoDigital.create({
      data: {
        tenantId,
        filialId: dto.filialId || null,
        nome: dto.nome.trim(),
        tipo: dto.tipo || 'A1',
        arquivo: dto.arquivo,
        senhaCriptografada: this.encrypt(dto.senha),
        cnpj: dto.cnpj || null,
        validoDe: dto.validoDe ? new Date(dto.validoDe) : null,
        validoAte: dto.validoAte ? new Date(dto.validoAte) : null,
        ativo: true,
      },
    });
    this.logger.log(`🔐 Certificado "${created.nome}" cadastrado (senha cifrada).`);
    return this.safe(created);
  }

  async desativar(tenantId: string, id: string) {
    const cert = await this.prisma.certificadoDigital.findFirst({ where: { id, tenantId } });
    if (!cert) throw new NotFoundException('Certificado não encontrado.');
    const upd = await this.prisma.certificadoDigital.update({ where: { id }, data: { ativo: false } });
    return this.safe(upd);
  }

  async ativar(tenantId: string, id: string) {
    const cert = await this.prisma.certificadoDigital.findFirst({ where: { id, tenantId } });
    if (!cert) throw new NotFoundException('Certificado não encontrado.');
    const upd = await this.prisma.certificadoDigital.update({ where: { id }, data: { ativo: true } });
    return this.safe(upd);
  }

  async remover(tenantId: string, id: string) {
    const cert = await this.prisma.certificadoDigital.findFirst({ where: { id, tenantId } });
    if (!cert) throw new NotFoundException('Certificado não encontrado.');
    await this.prisma.certificadoDigital.delete({ where: { id } });
    return { removido: true };
  }
}
