import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SalvarConfiguracaoFiscalDto } from './dto/configuracao-fiscal.dto';

@Injectable()
export class ConfiguracaoFiscalService {
  constructor(private prisma: PrismaService) {}

  private chave(): Buffer {
    const raw = process.env.FISCAL_ENC_KEY || process.env.CERT_ENC_KEY || '';
    if (raw.length < 16) throw new BadRequestException('FISCAL_ENC_KEY não configurada (mínimo de 16 caracteres). Nenhuma credencial foi salva.');
    return crypto.createHash('sha256').update(raw).digest();
  }

  private cifrar(valor: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.chave(), iv);
    const data = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
  }

  private decifrar(valor: string) {
    const [iv, tag, data] = valor.split(':');
    if (!iv || !tag || !data) throw new BadRequestException('Credencial fiscal cifrada inválida.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.chave(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }

  private async validarFilial(tenantId: string, filialId: string) {
    const filial = await this.prisma.filial.findFirst({ where: { id: filialId, tenantId } });
    if (!filial) throw new NotFoundException('Filial não encontrada.');
    return filial;
  }

  private seguro(config: any, filial?: any) {
    if (!config) return null;
    const { tokenCriptografado, cscCriptografado, ...resto } = config;
    return {
      ...resto,
      filial: filial ? { id: filial.id, codigo: filial.codigo, nome: filial.nome, cnpj: filial.cnpj, ie: filial.ie, crt: filial.crt } : undefined,
      tokenConfigurado: Boolean(tokenCriptografado),
      cscConfigurado: Boolean(cscCriptografado),
    };
  }

  async obter(tenantId: string, filialId: string) {
    const filial = await this.validarFilial(tenantId, filialId);
    const config = await this.prisma.configuracaoFiscal.findUnique({ where: { filialId } });
    if (config) return this.seguro(config, filial);
    return {
      filial: { id: filial.id, codigo: filial.codigo, nome: filial.nome, cnpj: filial.cnpj, ie: filial.ie, crt: filial.crt },
      filialId,
      provedor: 'FOCUS_NFE', ambiente: 'HOMOLOGACAO', ativo: false,
      baseUrl: '', serieNfe: '1', serieNfce: '1', statusConexao: 'PENDENTE',
      tokenConfigurado: false, cscConfigurado: false, configPublica: {},
    };
  }

  async salvar(tenantId: string, filialId: string, dto: SalvarConfiguracaoFiscalDto) {
    await this.validarFilial(tenantId, filialId);
    const existente = await this.prisma.configuracaoFiscal.findUnique({ where: { filialId } });
    const baseUrl = (dto.baseUrl || '').trim().replace(/\/$/, '') || null;
    if (dto.ambiente === 'PRODUCAO' && baseUrl && !baseUrl.startsWith('https://')) throw new BadRequestException('Em produção, a URL fiscal precisa usar HTTPS.');
    if (dto.ativo && dto.provedor !== 'FOCUS_NFE') throw new BadRequestException('O adaptador deste provedor ainda não foi instalado. Salve-o inativo até a documentação da API ser configurada.');
    const dados: any = {
      tenantId, filialId, provedor: dto.provedor, ambiente: dto.ambiente, ativo: dto.ativo,
      baseUrl, cscId: dto.cscId?.trim() || null, serieNfe: dto.serieNfe?.trim() || '1', serieNfce: dto.serieNfce?.trim() || '1',
      configPublica: dto.configPublica || {}, statusConexao: 'PENDENTE', mensagemStatus: 'Configuração alterada; valide antes de emitir.',
    };
    if (dto.removerToken) dados.tokenCriptografado = null;
    else if (dto.token?.trim()) dados.tokenCriptografado = this.cifrar(dto.token.trim());
    if (dto.removerCsc) dados.cscCriptografado = null;
    else if (dto.csc?.trim()) dados.cscCriptografado = this.cifrar(dto.csc.trim());
    const salvo = existente
      ? await this.prisma.configuracaoFiscal.update({ where: { id: existente.id }, data: dados })
      : await this.prisma.configuracaoFiscal.create({ data: dados });
    return this.seguro(salvo);
  }

  async diagnostico(tenantId?: string, filialId?: string) {
    const config = tenantId && filialId ? await this.prisma.configuracaoFiscal.findFirst({ where: { tenantId, filialId } }) : null;
    const provedor = config?.provedor || (process.env.NFE_PROVIDER || 'mock').toUpperCase();
    const ambiente = config?.ambiente || (process.env.NFE_AMBIENTE || 'homologacao').toUpperCase();
    const tokenConfigurado = Boolean(config?.tokenCriptografado || process.env.FOCUS_NFE_TOKEN);
    const adapterDisponivel = ['FOCUS_NFE', 'FOCUS'].includes(provedor);
    const ativo = config ? config.ativo : (process.env.NFE_PROVIDER || 'mock').toLowerCase() !== 'mock';
    return {
      provider: provedor, ambiente, ativo, tokenConfigurado,
      cscConfigurado: Boolean(config?.cscCriptografado), adapterDisponivel,
      simulacao: !ativo, prontoParaTransmitir: ativo && adapterDisponivel && tokenConfigurado,
      aviso: ambiente === 'PRODUCAO' ? 'Produção: emissões possuem validade fiscal.' : 'Homologação: ambiente sem validade fiscal.',
      origemConfiguracao: config ? 'FILIAL' : 'AMBIENTE_SERVIDOR',
    };
  }

  /**
   * Ping real no provedor Focus NFe: valida o token com autenticação Basic
   * (token como usuário, senha vazia). Usa GET numa referência sentinela:
   *   token inválido  → HTTP 401/403 ("permissao_negada")  → vermelho
   *   token válido     → HTTP 404 ("nao_encontrado", ref inexistente) → verde
   * (o endpoint /v2/empresas responde 404 mesmo com token falso, por isso não serve.)
   */
  private async pingFocus(config: any): Promise<{ ok: boolean; mensagem: string }> {
    let token = '';
    try { token = this.decifrar(config.tokenCriptografado); }
    catch { return { ok: false, mensagem: 'Não foi possível descriptografar o token salvo (verifique FISCAL_ENC_KEY).' }; }
    const ambiente = (config.ambiente || 'HOMOLOGACAO').toLowerCase();
    const baseUrl = (config.baseUrl || (ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br')).replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch(`${baseUrl}/v2/nfe/lumin-teste-conexao?completa=1`, {
        method: 'GET',
        headers: { Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (resp.status === 401 || resp.status === 403) return { ok: false, mensagem: `Token recusado pelo provedor (HTTP ${resp.status}). Confira o token da Focus NFe e o ambiente (homologação × produção).` };
      if (resp.status === 404 || resp.ok) return { ok: true, mensagem: `Conexão com a Focus NFe validada (${ambiente}). Token aceito.` };
      return { ok: false, mensagem: `Provedor respondeu HTTP ${resp.status}. Tente novamente em instantes.` };
    } catch (e: any) {
      if (e?.name === 'AbortError') return { ok: false, mensagem: 'Tempo esgotado (12s) ao contatar o provedor. Verifique a rede/URL.' };
      return { ok: false, mensagem: `Falha de rede ao contatar o provedor: ${e?.message || e}.` };
    } finally { clearTimeout(timeout); }
  }

  async validar(tenantId: string, filialId: string) {
    const filial = await this.validarFilial(tenantId, filialId);
    const config = await this.prisma.configuracaoFiscal.findFirst({ where: { tenantId, filialId } });
    if (!config) throw new BadRequestException('Salve a configuração fiscal desta filial primeiro.');
    const pendencias = [!filial.cnpj && 'CNPJ', !filial.ie && 'IE', !filial.crt && 'CRT', !config.tokenCriptografado && 'token do provedor'].filter(Boolean);
    const adapterDisponivel = config.provedor === 'FOCUS_NFE';
    if (!adapterDisponivel) pendencias.push('adaptador do provedor');

    // Se os dados mínimos estão presentes, testa a conexão de verdade com o provedor.
    let conexao: { ok: boolean; mensagem: string } | null = null;
    if (pendencias.length === 0 && config.tokenCriptografado) {
      conexao = await this.pingFocus(config);
      if (!conexao.ok) pendencias.push('conexão com o provedor');
    }

    const ok = pendencias.length === 0;
    const mensagemStatus = ok
      ? `${conexao?.mensagem || 'Dados mínimos conferidos.'} Realize emissões de homologação antes de ativar produção.`
      : `Pendências: ${pendencias.join(', ')}.${conexao && !conexao.ok ? ` ${conexao.mensagem}` : ''}`;
    const atualizado = await this.prisma.configuracaoFiscal.update({ where: { id: config.id }, data: {
      statusConexao: ok ? 'PRONTO_HOMOLOGACAO' : 'PENDENTE', ultimoTesteEm: new Date(),
      mensagemStatus,
    } });
    return { ...this.seguro(atualizado, filial), ok, pendencias, conexao };
  }

  async resolverCredencial(tenantId?: string, filialId?: string) {
    const config = tenantId && filialId ? await this.prisma.configuracaoFiscal.findFirst({ where: { tenantId, filialId, ativo: true } }) : null;
    if (config?.provedor && config.provedor !== 'FOCUS_NFE') throw new BadRequestException(`Adaptador fiscal ${config.provedor} ainda não implementado.`);
    const ambiente = (config?.ambiente || process.env.NFE_AMBIENTE || 'HOMOLOGACAO').toLowerCase();
    const token = config?.tokenCriptografado ? this.decifrar(config.tokenCriptografado) : (process.env.FOCUS_NFE_TOKEN || '');
    const baseUrl = (config?.baseUrl || process.env.FOCUS_NFE_URL || (ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br')).replace(/\/$/, '');
    return { token, ambiente, baseUrl, origem: config ? 'filial' : 'env' };
  }

  async deveTransmitir(tenantId?: string, filialId?: string) {
    const config = tenantId && filialId ? await this.prisma.configuracaoFiscal.findFirst({ where: { tenantId, filialId } }) : null;
    if (config) return config.ativo && config.provedor === 'FOCUS_NFE';
    return !['', 'mock', 'simulado'].includes((process.env.NFE_PROVIDER || 'mock').toLowerCase());
  }

  async possuiCredencial(tenantId?: string, filialId?: string) {
    const config = tenantId && filialId ? await this.prisma.configuracaoFiscal.findFirst({ where: { tenantId, filialId } }) : null;
    return Boolean(config?.tokenCriptografado || process.env.FOCUS_NFE_TOKEN);
  }
}
