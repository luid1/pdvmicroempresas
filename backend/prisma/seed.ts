/**
 * Seed: cria o tenant Mercado Central, a loja e os usuários base + catálogo de varejo.
 * Rodar: npx ts-node prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do Mercado PDV...\n');

  // ── 1. Permissões base do sistema ──────────────────────────────
  const modulos = ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO', 'CADASTROS', 'AUDITORIA', 'RELATORIOS', 'GERENCIAL'];
  const acoes   = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EMITIR', 'APROVAR', 'CANCELAR', 'OPERAR', 'CONFIGURAR'];

  for (const modulo of modulos) {
    for (const acao of acoes) {
      await prisma.permissao.upsert({
        where: { modulo_acao: { modulo, acao } },
        update: {},
        create: { modulo, acao, descricao: `${acao} em ${modulo}` },
      });
    }
  }
  console.log(`✅ ${modulos.length * acoes.length} permissões criadas`);

  // ── 2. Tenant: Mercado Central ─────────────────────────────────
  let tenant = await prisma.tenant.findUnique({ where: { cnpj: '00.000.000/0001-00' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        razaoSocial:       'Mercado Central Ltda',
        nomeFantasia:      'Mercado Central',
        cnpj:              '00.000.000/0001-00',
        regimeTributario:  'SIMPLES_NACIONAL',
        crt:               1,
      },
    });
    console.log(`✅ Tenant criado: ${tenant.razaoSocial}`);
  } else {
    console.log(`ℹ️  Tenant já existe: ${tenant.razaoSocial}`);
  }

  // ── 3. Filial: Loja 01 ─────────────────────────────────────────
  let filial = await prisma.filial.findUnique({
    where: { tenantId_codigo: { tenantId: tenant.id, codigo: '1001' } },
  });
  if (!filial) {
    filial = await prisma.filial.create({
      data: {
        tenantId: tenant.id,
        codigo:   '1001',
        nome:     'Mercado Central - Loja 01',
        tipo:     'MATRIZ',
        endereco: {
          rua:    'Av. Dr. Gastão Vidigal',
          numero: '1946',
          bairro: 'Vila Leopoldina',
          cidade: 'São Paulo',
          uf:     'SP',
          cep:    '05313-900',
        },
      },
    });
    console.log(`✅ Filial criada: ${filial.nome}`);
  } else {
    console.log(`ℹ️  Filial já existe: ${filial.nome}`);
  }

  // ── 4. Roles ───────────────────────────────────────────────────
  const todasPermissoes = await prisma.permissao.findMany();

  // Telas (rotas do frontend) que cada perfil enxerga no menu.
  const TELAS_GERENTE = [
    '/dashboard', '/pdv',
    '/cadastros/produtos', '/cadastros/tabelas-preco', '/cadastros/fornecedores', '/cadastros/clientes', '/cadastros/filiais',
    '/wms/posicao', '/wms/pereciveis', '/wms/entradas', '/wms/movimentacoes', '/wms/inventario', '/wms/compras', '/wms/devolucoes-compra', '/wms/analise-estoque',
    '/fiscal/emitir', '/fiscal/gestao', '/fiscal/nfe', '/fiscal/matriz',
    '/financeiro/dre', '/financeiro/fluxo-caixa', '/financeiro/receber', '/financeiro/pagar', '/financeiro/custos', '/financeiro/tesouraria', '/financeiro/plano-contas',
    '/gerencial/relatorios', '/gerencial/usuarios', '/gerencial/configuracoes', '/gerencial/auditoria',
  ];
  const TELAS_CAIXA = ['/pdv'];
  const TELAS_ESTOQUISTA = ['/cadastros/produtos', '/wms/posicao', '/wms/pereciveis', '/wms/entradas', '/wms/movimentacoes', '/wms/inventario', '/wms/compras'];

  const rolesDefs = [
    {
      nome:        'ADMIN',
      descricao:   'Dono / Administrador — acesso total',
      telas:       ['*'],
      telaInicial: '/dashboard',
      perms:       todasPermissoes.map((p) => p.id), // tudo
    },
    {
      nome:        'GERENTE',
      descricao:   'Gerente da loja — operação, estoque, financeiro e relatórios',
      telas:       TELAS_GERENTE,
      telaInicial: '/dashboard',
      perms:       todasPermissoes.filter((p) => p.acao !== 'DELETE').map((p) => p.id),
    },
    {
      nome:        'OPERADOR_CAIXA',
      descricao:   'Operador de caixa — frente de caixa (PDV)',
      telas:       TELAS_CAIXA,
      telaInicial: '/pdv',
      perms:       todasPermissoes
        .filter((p) => ['ESTOQUE', 'PEDIDOS', 'NFE', 'FINANCEIRO'].includes(p.modulo) && ['CREATE', 'READ', 'UPDATE', 'EMITIR'].includes(p.acao))
        .map((p) => p.id),
    },
    {
      nome:        'ESTOQUISTA',
      descricao:   'Estoquista / repositor — produtos, estoque e entradas',
      telas:       TELAS_ESTOQUISTA,
      telaInicial: '/wms/posicao',
      perms:       todasPermissoes
        .filter((p) =>
          (p.modulo === 'ESTOQUE' && p.acao !== 'DELETE') ||
          (p.modulo === 'CADASTROS' && ['CREATE', 'READ', 'UPDATE'].includes(p.acao)) ||
          (p.modulo === 'PEDIDOS' && p.acao === 'READ'))
        .map((p) => p.id),
    },
  ];

  const rolesMap: Record<string, string> = {};
  for (const rd of rolesDefs) {
    let role = await prisma.role.findUnique({
      where: { tenantId_nome: { tenantId: tenant.id, nome: rd.nome } },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId:    tenant.id,
          nome:        rd.nome,
          descricao:   rd.descricao,
          telas:       rd.telas,
          telaInicial: rd.telaInicial,
          permissoes:  { create: rd.perms.map((id) => ({ permissaoId: id })) },
        },
      });
      console.log(`✅ Role criada: ${role.nome}`);
    } else {
      console.log(`ℹ️  Role já existe: ${role.nome}`);
    }
    rolesMap[rd.nome] = role.id;
  }

  // ── 5. Usuários ────────────────────────────────────────────────
  const usuariosBase = [
    {
      nome:     'Administrador',
      email:    'admin@mercado.com',
      password: 'admin123',
      pin:      '1234',
      role:     'ADMIN',
    },
    {
      nome:     'Operador de Caixa',
      email:    'caixa@mercado.com',
      password: 'caixa123',
      pin:      '3456',
      role:     'OPERADOR_CAIXA',
    },
    {
      nome:     'Gerente',
      email:    'gerente@mercado.com',
      password: 'gerente123',
      pin:      '2345',
      role:     'GERENTE',
    },
    {
      nome:     'Estoquista',
      email:    'estoque@mercado.com',
      password: 'estoque123',
      pin:      '4567',
      role:     'ESTOQUISTA',
    },
  ];

  for (const u of usuariosBase) {
    const hash = await bcrypt.hash(u.password, 12);
    const pinHash = await bcrypt.hash(u.pin, 10);
    const existe = await prisma.usuario.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
    });
    if (!existe) {
      const novo = await prisma.usuario.create({
        data: {
          tenantId:     tenant.id,
          roleId:       rolesMap[u.role],
          nome:         u.nome,
          email:        u.email,
          passwordHash: hash,
          pinHash,
          filiais:      { create: { filialId: filial.id } },
        },
      });
      console.log(`✅ Usuário criado: ${novo.nome} (${u.role}) — senha: ${u.password} · PIN: ${u.pin}`);
    } else {
      // Garante que o PIN exista mesmo em bancos já semeados antes desta feature.
      await prisma.usuario.update({ where: { id: existe.id }, data: { pinHash } });
      console.log(`ℹ️  Usuário já existe: ${u.nome} — PIN atualizado: ${u.pin}`);
    }
  }

  // ── 6. Localizações físicas de exemplo ─────────────────────────
  const localizacoes = [
    { rua: 'A', prateleira: '1' }, { rua: 'A', prateleira: '2' },
    { rua: 'B', prateleira: '1' }, { rua: 'B', prateleira: '2' },
    { rua: 'C', prateleira: '1' }, { rua: 'C', prateleira: '2' },
    { rua: 'CÂMARA', prateleira: '1' }, { rua: 'CÂMARA', prateleira: '2' },
  ];
  for (const loc of localizacoes) {
    await prisma.localizacaoFisica.upsert({
      where: { tenantId_filialId_rua_prateleira: { tenantId: tenant.id, filialId: filial.id, rua: loc.rua, prateleira: loc.prateleira } },
      update: {},
      create: { tenantId: tenant.id, filialId: filial.id, ...loc },
    });
  }
  console.log(`✅ ${localizacoes.length} localizações físicas criadas`);

  // ── 7. Unidades de medida ──────────────────────────────────────
  const unidadesDefs = [
    { sigla: 'KG', descricao: 'Quilograma' },
    { sigla: 'UN', descricao: 'Unidade' },
    { sigla: 'L',  descricao: 'Litro' },
    { sigla: 'PCT', descricao: 'Pacote' },
    { sigla: 'CX', descricao: 'Caixa' },
    { sigla: 'DZ', descricao: 'Dúzia' },
  ];
  const umMap: Record<string, string> = {};
  for (const u of unidadesDefs) {
    const um = await prisma.unidadeMedida.upsert({
      where: { tenantId_sigla: { tenantId: tenant.id, sigla: u.sigla } },
      update: {},
      create: { tenantId: tenant.id, sigla: u.sigla, descricao: u.descricao },
    });
    umMap[u.sigla] = um.id;
  }
  console.log(`✅ ${unidadesDefs.length} unidades de medida criadas`);

  // ── 8. Catálogo de varejo + saldo de estoque ───────────────────
  // Itens marcados com `peso: true` são vendidos por balança (KG): hortifrúti e
  // açougue/frios. Recebem código de barras com prefixo 2 (padrão de balança).
  type ItemCat = { d: string; ncm: string; un: string; pv: number; est: number; sec: string; peso?: boolean };
  const catalogo: ItemCat[] = [
    // ── Mercearia ──────────────────────────────────────────────
    { d: 'Arroz Tio João Tipo 1 5kg', ncm: '10063021', un: 'PCT', pv: 24.90, est: 120, sec: 'Mercearia' },
    { d: 'Arroz Camil Tipo 1 5kg', ncm: '10063021', un: 'PCT', pv: 26.50, est: 90, sec: 'Mercearia' },
    { d: 'Arroz Prato Fino 5kg', ncm: '10063021', un: 'PCT', pv: 23.90, est: 70, sec: 'Mercearia' },
    { d: 'Arroz Integral Camil 1kg', ncm: '10062020', un: 'PCT', pv: 8.90, est: 60, sec: 'Mercearia' },
    { d: 'Feijão Carioca Camil 1kg', ncm: '07133399', un: 'PCT', pv: 8.49, est: 150, sec: 'Mercearia' },
    { d: 'Feijão Preto Camil 1kg', ncm: '07133399', un: 'PCT', pv: 8.99, est: 100, sec: 'Mercearia' },
    { d: 'Feijão Kicaldo 1kg', ncm: '07133399', un: 'PCT', pv: 7.99, est: 80, sec: 'Mercearia' },
    { d: 'Açúcar Refinado União 1kg', ncm: '17019900', un: 'PCT', pv: 4.99, est: 200, sec: 'Mercearia' },
    { d: 'Açúcar Cristal 5kg', ncm: '17019900', un: 'PCT', pv: 22.90, est: 60, sec: 'Mercearia' },
    { d: 'Açúcar Demerara 1kg', ncm: '17019900', un: 'PCT', pv: 9.90, est: 40, sec: 'Mercearia' },
    { d: 'Café Pilão a Vácuo 500g', ncm: '09012100', un: 'PCT', pv: 15.90, est: 110, sec: 'Mercearia' },
    { d: 'Café Melitta Tradicional 500g', ncm: '09012100', un: 'PCT', pv: 16.50, est: 80, sec: 'Mercearia' },
    { d: 'Café 3 Corações 500g', ncm: '09012100', un: 'PCT', pv: 15.49, est: 70, sec: 'Mercearia' },
    { d: 'Café Solúvel Nescafé 200g', ncm: '21011110', un: 'UN', pv: 22.90, est: 45, sec: 'Mercearia' },
    { d: 'Óleo de Soja Soya 900ml', ncm: '15079011', un: 'UN', pv: 7.49, est: 180, sec: 'Mercearia' },
    { d: 'Óleo de Soja Liza 900ml', ncm: '15079011', un: 'UN', pv: 7.29, est: 160, sec: 'Mercearia' },
    { d: 'Azeite Português Gallo 500ml', ncm: '15091000', un: 'UN', pv: 32.90, est: 40, sec: 'Mercearia' },
    { d: 'Óleo de Girassol 900ml', ncm: '15121110', un: 'UN', pv: 9.90, est: 50, sec: 'Mercearia' },
    { d: 'Macarrão Espaguete Renata 500g', ncm: '19021900', un: 'PCT', pv: 4.49, est: 200, sec: 'Mercearia' },
    { d: 'Macarrão Parafuso Adria 500g', ncm: '19021900', un: 'PCT', pv: 4.99, est: 150, sec: 'Mercearia' },
    { d: 'Macarrão Instantâneo Nissin 85g', ncm: '19023000', un: 'UN', pv: 2.49, est: 300, sec: 'Mercearia' },
    { d: 'Massa para Lasanha 500g', ncm: '19021900', un: 'PCT', pv: 6.90, est: 60, sec: 'Mercearia' },
    { d: 'Farinha de Trigo Dona Benta 1kg', ncm: '11010010', un: 'PCT', pv: 5.49, est: 120, sec: 'Mercearia' },
    { d: 'Farinha de Mandioca 1kg', ncm: '11062000', un: 'PCT', pv: 6.90, est: 70, sec: 'Mercearia' },
    { d: 'Farinha de Milho Flocão 500g', ncm: '11022000', un: 'PCT', pv: 3.90, est: 80, sec: 'Mercearia' },
    { d: 'Amido de Milho Maizena 500g', ncm: '11081200', un: 'UN', pv: 7.90, est: 60, sec: 'Mercearia' },
    { d: 'Fubá Mimoso 1kg', ncm: '11022000', un: 'PCT', pv: 4.49, est: 70, sec: 'Mercearia' },
    { d: 'Molho de Tomate Pomarola 340g', ncm: '21032010', un: 'UN', pv: 3.49, est: 200, sec: 'Mercearia' },
    { d: 'Extrato de Tomate Elefante 340g', ncm: '20029000', un: 'UN', pv: 4.29, est: 120, sec: 'Mercearia' },
    { d: 'Molho de Tomate Quero 340g', ncm: '21032010', un: 'UN', pv: 2.99, est: 150, sec: 'Mercearia' },
    { d: 'Sardinha Gomes da Costa 125g', ncm: '16041311', un: 'UN', pv: 6.49, est: 140, sec: 'Mercearia' },
    { d: 'Atum Ralado Coqueiro 170g', ncm: '16041400', un: 'UN', pv: 9.90, est: 90, sec: 'Mercearia' },
    { d: 'Milho Verde em Conserva 200g', ncm: '20058000', un: 'UN', pv: 3.49, est: 130, sec: 'Mercearia' },
    { d: 'Ervilha em Conserva 200g', ncm: '20054000', un: 'UN', pv: 3.49, est: 130, sec: 'Mercearia' },
    { d: 'Seleta de Legumes 200g', ncm: '20059000', un: 'UN', pv: 4.49, est: 80, sec: 'Mercearia' },
    { d: 'Bolacha Cream Cracker Adria 400g', ncm: '19053100', un: 'PCT', pv: 5.49, est: 160, sec: 'Mercearia' },
    { d: 'Bolacha Recheada Trakinas 130g', ncm: '19053100', un: 'UN', pv: 3.29, est: 200, sec: 'Mercearia' },
    { d: 'Biscoito Maisena Marilan 400g', ncm: '19053100', un: 'PCT', pv: 4.49, est: 140, sec: 'Mercearia' },
    { d: 'Bolacha Água e Sal 400g', ncm: '19053100', un: 'PCT', pv: 4.99, est: 120, sec: 'Mercearia' },
    { d: 'Biscoito Recheado Negresco 140g', ncm: '19053100', un: 'UN', pv: 3.49, est: 180, sec: 'Mercearia' },
    { d: 'Wafer Bauducco Chocolate 140g', ncm: '19053200', un: 'UN', pv: 3.99, est: 120, sec: 'Mercearia' },
    { d: 'Sal Refinado Cisne 1kg', ncm: '25010020', un: 'PCT', pv: 2.49, est: 150, sec: 'Mercearia' },
    { d: 'Sal Grosso Churrasco 1kg', ncm: '25010020', un: 'PCT', pv: 3.49, est: 60, sec: 'Mercearia' },
    { d: 'Vinagre de Álcool 750ml', ncm: '22090000', un: 'UN', pv: 3.49, est: 90, sec: 'Mercearia' },
    { d: 'Vinagre de Maçã 750ml', ncm: '22090000', un: 'UN', pv: 6.90, est: 50, sec: 'Mercearia' },
    { d: 'Tempero Completo Sazón 60g', ncm: '21039021', un: 'UN', pv: 3.29, est: 120, sec: 'Mercearia' },
    { d: 'Caldo de Galinha Knorr 57g', ncm: '21041011', un: 'UN', pv: 2.99, est: 130, sec: 'Mercearia' },
    { d: 'Orégano 10g', ncm: '12119090', un: 'UN', pv: 2.49, est: 100, sec: 'Mercearia' },
    { d: 'Colorau 100g', ncm: '09042200', un: 'UN', pv: 2.99, est: 80, sec: 'Mercearia' },
    { d: 'Pimenta do Reino Moída 30g', ncm: '09042100', un: 'UN', pv: 4.49, est: 70, sec: 'Mercearia' },
    { d: 'Maionese Hellmanns 500g', ncm: '21039011', un: 'UN', pv: 9.90, est: 100, sec: 'Mercearia' },
    { d: 'Ketchup Heinz 397g', ncm: '21032010', un: 'UN', pv: 8.90, est: 90, sec: 'Mercearia' },
    { d: 'Mostarda Hemmer 200g', ncm: '21033000', un: 'UN', pv: 4.49, est: 70, sec: 'Mercearia' },
    { d: 'Leite Condensado Moça 395g', ncm: '04029900', un: 'UN', pv: 7.49, est: 140, sec: 'Mercearia' },
    { d: 'Creme de Leite Nestlé 200g', ncm: '04013010', un: 'UN', pv: 3.99, est: 160, sec: 'Mercearia' },
    { d: 'Achocolatado Nescau 400g', ncm: '18061000', un: 'UN', pv: 9.90, est: 110, sec: 'Mercearia' },
    { d: 'Chocolate em Pó 50% 200g', ncm: '18061000', un: 'UN', pv: 8.49, est: 70, sec: 'Mercearia' },
    { d: 'Gelatina Royal Morango 20g', ncm: '21079000', un: 'UN', pv: 2.29, est: 120, sec: 'Mercearia' },
    { d: 'Aveia em Flocos Quaker 200g', ncm: '11041200', un: 'UN', pv: 5.49, est: 80, sec: 'Mercearia' },
    { d: 'Granola Tradicional 500g', ncm: '19041000', un: 'PCT', pv: 14.90, est: 50, sec: 'Mercearia' },
    { d: 'Mel Silvestre 500g', ncm: '04090000', un: 'UN', pv: 18.90, est: 40, sec: 'Mercearia' },
    { d: 'Fermento em Pó Royal 100g', ncm: '21021000', un: 'UN', pv: 4.49, est: 90, sec: 'Mercearia' },
    { d: 'Fermento Biológico Seco 10g', ncm: '21021000', un: 'UN', pv: 2.49, est: 100, sec: 'Mercearia' },

    // ── Bebidas ────────────────────────────────────────────────
    { d: 'Refrigerante Coca-Cola 2L', ncm: '22021000', un: 'UN', pv: 9.99, est: 200, sec: 'Bebidas' },
    { d: 'Refrigerante Guaraná Antarctica 2L', ncm: '22021000', un: 'UN', pv: 8.49, est: 180, sec: 'Bebidas' },
    { d: 'Refrigerante Fanta Laranja 2L', ncm: '22021000', un: 'UN', pv: 7.99, est: 120, sec: 'Bebidas' },
    { d: 'Refrigerante Sprite 2L', ncm: '22021000', un: 'UN', pv: 7.99, est: 100, sec: 'Bebidas' },
    { d: 'Coca-Cola Lata 350ml', ncm: '22021000', un: 'UN', pv: 4.49, est: 300, sec: 'Bebidas' },
    { d: 'Guaraná Antarctica Lata 350ml', ncm: '22021000', un: 'UN', pv: 3.99, est: 250, sec: 'Bebidas' },
    { d: 'Suco Del Valle Uva 1L', ncm: '20099000', un: 'UN', pv: 8.90, est: 90, sec: 'Bebidas' },
    { d: 'Suco em Pó Tang Laranja 25g', ncm: '21069090', un: 'UN', pv: 1.49, est: 300, sec: 'Bebidas' },
    { d: 'Água Mineral Crystal 1,5L', ncm: '22011000', un: 'UN', pv: 2.99, est: 200, sec: 'Bebidas' },
    { d: 'Água Mineral 500ml', ncm: '22011000', un: 'UN', pv: 1.99, est: 300, sec: 'Bebidas' },
    { d: 'Água com Gás 500ml', ncm: '22011000', un: 'UN', pv: 2.49, est: 150, sec: 'Bebidas' },
    { d: 'Cerveja Skol Lata 350ml', ncm: '22030000', un: 'UN', pv: 3.49, est: 400, sec: 'Bebidas' },
    { d: 'Cerveja Brahma Lata 350ml', ncm: '22030000', un: 'UN', pv: 3.69, est: 350, sec: 'Bebidas' },
    { d: 'Cerveja Heineken Long Neck 330ml', ncm: '22030000', un: 'UN', pv: 5.90, est: 200, sec: 'Bebidas' },
    { d: 'Cerveja Budweiser Long Neck 330ml', ncm: '22030000', un: 'UN', pv: 5.49, est: 150, sec: 'Bebidas' },
    { d: 'Energético Red Bull 250ml', ncm: '22029900', un: 'UN', pv: 9.90, est: 120, sec: 'Bebidas' },
    { d: 'Energético Monster 473ml', ncm: '22029900', un: 'UN', pv: 10.90, est: 90, sec: 'Bebidas' },
    { d: 'Chá Gelado Lipton Limão 1,5L', ncm: '22029900', un: 'UN', pv: 7.90, est: 70, sec: 'Bebidas' },
    { d: 'Isotônico Gatorade 500ml', ncm: '22029900', un: 'UN', pv: 6.49, est: 100, sec: 'Bebidas' },
    { d: 'Vinho Tinto Suave 750ml', ncm: '22042100', un: 'UN', pv: 24.90, est: 60, sec: 'Bebidas' },

    // ── Laticínios / Frios ─────────────────────────────────────
    { d: 'Leite Integral Italac 1L', ncm: '04012010', un: 'UN', pv: 4.99, est: 300, sec: 'Laticínios' },
    { d: 'Leite Desnatado Parmalat 1L', ncm: '04011010', un: 'UN', pv: 5.29, est: 150, sec: 'Laticínios' },
    { d: 'Leite Semidesnatado 1L', ncm: '04012010', un: 'UN', pv: 5.09, est: 200, sec: 'Laticínios' },
    { d: 'Leite em Pó Ninho 400g', ncm: '04022110', un: 'UN', pv: 18.90, est: 80, sec: 'Laticínios' },
    { d: 'Iogurte Natural Nestlé 170g', ncm: '04031000', un: 'UN', pv: 3.49, est: 120, sec: 'Laticínios' },
    { d: 'Iogurte Grego Vigor 100g', ncm: '04031000', un: 'UN', pv: 4.49, est: 100, sec: 'Laticínios' },
    { d: 'Bebida Láctea Danone 900g', ncm: '04039000', un: 'UN', pv: 8.90, est: 70, sec: 'Laticínios' },
    { d: 'Requeijão Cremoso Catupiry 200g', ncm: '04061090', un: 'UN', pv: 8.90, est: 90, sec: 'Laticínios' },
    { d: 'Manteiga Aviação com Sal 200g', ncm: '04051000', un: 'UN', pv: 12.90, est: 60, sec: 'Laticínios' },
    { d: 'Margarina Qualy 500g', ncm: '15171000', un: 'UN', pv: 8.49, est: 100, sec: 'Laticínios' },
    { d: 'Queijo Ralado Parmesão 50g', ncm: '04069010', un: 'UN', pv: 4.49, est: 80, sec: 'Laticínios' },
    { d: 'Leite Fermentado Yakult 6un', ncm: '04039000', un: 'PCT', pv: 7.90, est: 60, sec: 'Laticínios' },
    { d: 'Cream Cheese 150g', ncm: '04061010', un: 'UN', pv: 9.90, est: 50, sec: 'Laticínios' },
    { d: 'Queijo Mussarela Fatiado', ncm: '04061090', un: 'KG', pv: 39.90, est: 30, sec: 'Frios', peso: true },
    { d: 'Queijo Prato Fatiado', ncm: '04069010', un: 'KG', pv: 42.90, est: 25, sec: 'Frios', peso: true },
    { d: 'Presunto Cozido Fatiado', ncm: '16024900', un: 'KG', pv: 32.90, est: 20, sec: 'Frios', peso: true },
    { d: 'Mortadela Fatiada', ncm: '16024900', un: 'KG', pv: 18.90, est: 25, sec: 'Frios', peso: true },

    // ── Padaria ────────────────────────────────────────────────
    { d: 'Pão Francês', ncm: '19059090', un: 'KG', pv: 15.90, est: 40, sec: 'Padaria', peso: true },
    { d: 'Pão de Forma Pullman 500g', ncm: '19059090', un: 'UN', pv: 8.90, est: 80, sec: 'Padaria' },
    { d: 'Pão de Forma Integral 500g', ncm: '19059090', un: 'UN', pv: 9.90, est: 60, sec: 'Padaria' },
    { d: 'Bisnaguinha Seven Boys 300g', ncm: '19059090', un: 'PCT', pv: 6.49, est: 70, sec: 'Padaria' },
    { d: 'Bolo Caseiro Fatiado', ncm: '19059090', un: 'UN', pv: 12.90, est: 30, sec: 'Padaria' },
    { d: 'Pão de Queijo Congelado 400g', ncm: '19059090', un: 'PCT', pv: 11.90, est: 50, sec: 'Padaria' },
    { d: 'Rosca Doce', ncm: '19059090', un: 'UN', pv: 8.90, est: 30, sec: 'Padaria' },
    { d: 'Torrada Bauducco 160g', ncm: '19054000', un: 'UN', pv: 5.49, est: 60, sec: 'Padaria' },

    // ── Higiene / Limpeza ──────────────────────────────────────
    { d: 'Sabonete Dove 90g', ncm: '34011190', un: 'UN', pv: 3.49, est: 200, sec: 'Higiene' },
    { d: 'Sabonete Lux 85g', ncm: '34011190', un: 'UN', pv: 2.49, est: 200, sec: 'Higiene' },
    { d: 'Shampoo Seda 325ml', ncm: '33051000', un: 'UN', pv: 12.90, est: 90, sec: 'Higiene' },
    { d: 'Condicionador Seda 325ml', ncm: '33059000', un: 'UN', pv: 12.90, est: 80, sec: 'Higiene' },
    { d: 'Creme Dental Colgate 90g', ncm: '33061000', un: 'UN', pv: 4.99, est: 150, sec: 'Higiene' },
    { d: 'Escova de Dente Oral-B', ncm: '96032100', un: 'UN', pv: 5.90, est: 100, sec: 'Higiene' },
    { d: 'Papel Higiênico Neve 12 rolos', ncm: '48181000', un: 'PCT', pv: 18.90, est: 120, sec: 'Higiene' },
    { d: 'Papel Higiênico Personal 4 rolos', ncm: '48181000', un: 'PCT', pv: 7.90, est: 150, sec: 'Higiene' },
    { d: 'Absorvente Always 8un', ncm: '96190000', un: 'PCT', pv: 6.90, est: 90, sec: 'Higiene' },
    { d: 'Fralda Pampers M 30un', ncm: '96190000', un: 'PCT', pv: 39.90, est: 50, sec: 'Higiene' },
    { d: 'Desodorante Rexona Aerossol 150ml', ncm: '33072010', un: 'UN', pv: 14.90, est: 80, sec: 'Higiene' },
    { d: 'Detergente Ypê Neutro 500ml', ncm: '34022000', un: 'UN', pv: 2.49, est: 250, sec: 'Limpeza' },
    { d: 'Detergente Limpol 500ml', ncm: '34022000', un: 'UN', pv: 2.59, est: 200, sec: 'Limpeza' },
    { d: 'Sabão em Pó Omo 1kg', ncm: '34022000', un: 'PCT', pv: 14.90, est: 100, sec: 'Limpeza' },
    { d: 'Sabão em Barra Ypê 5un', ncm: '34011900', un: 'PCT', pv: 8.90, est: 90, sec: 'Limpeza' },
    { d: 'Amaciante Comfort 2L', ncm: '38091000', un: 'UN', pv: 12.90, est: 80, sec: 'Limpeza' },
    { d: 'Desinfetante Pinho Sol 500ml', ncm: '38089490', un: 'UN', pv: 6.90, est: 100, sec: 'Limpeza' },
    { d: 'Água Sanitária Qboa 2L', ncm: '38089419', un: 'UN', pv: 7.90, est: 120, sec: 'Limpeza' },
    { d: 'Limpador Multiuso Veja 500ml', ncm: '34022000', un: 'UN', pv: 7.49, est: 90, sec: 'Limpeza' },
    { d: 'Esponja de Aço Bombril 8un', ncm: '73239900', un: 'PCT', pv: 3.49, est: 150, sec: 'Limpeza' },
    { d: 'Esponja de Louça Dupla Face', ncm: '39229000', un: 'UN', pv: 1.49, est: 200, sec: 'Limpeza' },
    { d: 'Saco de Lixo 50L 30un', ncm: '39232990', un: 'PCT', pv: 8.90, est: 80, sec: 'Limpeza' },
    { d: 'Papel Toalha 2 rolos', ncm: '48180000', un: 'PCT', pv: 7.90, est: 100, sec: 'Limpeza' },
    { d: 'Guardanapo de Papel 50un', ncm: '48182000', un: 'PCT', pv: 3.49, est: 90, sec: 'Limpeza' },
    { d: 'Álcool 70% Líquido 1L', ncm: '22072010', un: 'UN', pv: 8.90, est: 110, sec: 'Limpeza' },
    { d: 'Inseticida SBP Aerossol 300ml', ncm: '38089110', un: 'UN', pv: 12.90, est: 60, sec: 'Limpeza' },

    // ── Hortifrúti (balança / KG) ──────────────────────────────
    { d: 'Banana Nanica', ncm: '08039000', un: 'KG', pv: 5.99, est: 80, sec: 'Hortifrúti', peso: true },
    { d: 'Maçã Gala', ncm: '08081000', un: 'KG', pv: 8.99, est: 60, sec: 'Hortifrúti', peso: true },
    { d: 'Tomate', ncm: '07020000', un: 'KG', pv: 7.49, est: 70, sec: 'Hortifrúti', peso: true },
    { d: 'Batata Lavada', ncm: '07019000', un: 'KG', pv: 5.49, est: 120, sec: 'Hortifrúti', peso: true },
    { d: 'Cebola', ncm: '07031019', un: 'KG', pv: 4.99, est: 100, sec: 'Hortifrúti', peso: true },
    { d: 'Cenoura', ncm: '07061000', un: 'KG', pv: 4.49, est: 80, sec: 'Hortifrúti', peso: true },
    { d: 'Laranja Pera', ncm: '08051000', un: 'KG', pv: 3.99, est: 90, sec: 'Hortifrúti', peso: true },
    { d: 'Mamão Formosa', ncm: '08072000', un: 'KG', pv: 6.99, est: 50, sec: 'Hortifrúti', peso: true },
    { d: 'Alface Crespa', ncm: '07051100', un: 'UN', pv: 3.49, est: 40, sec: 'Hortifrúti' },
    { d: 'Limão Taiti', ncm: '08055010', un: 'KG', pv: 5.99, est: 60, sec: 'Hortifrúti', peso: true },
    { d: 'Melancia', ncm: '08071100', un: 'KG', pv: 2.99, est: 100, sec: 'Hortifrúti', peso: true },
    { d: 'Batata Doce', ncm: '07142000', un: 'KG', pv: 5.99, est: 50, sec: 'Hortifrúti', peso: true },

    // ── Açougue (balança / KG) ─────────────────────────────────
    { d: 'Coxão Mole Bovino', ncm: '02013000', un: 'KG', pv: 39.90, est: 40, sec: 'Açougue', peso: true },
    { d: 'Patinho Moído', ncm: '02013000', un: 'KG', pv: 32.90, est: 50, sec: 'Açougue', peso: true },
    { d: 'Acém Bovino', ncm: '02013000', un: 'KG', pv: 28.90, est: 40, sec: 'Açougue', peso: true },
    { d: 'Peito de Frango', ncm: '02071400', un: 'KG', pv: 14.90, est: 60, sec: 'Açougue', peso: true },
    { d: 'Coxa e Sobrecoxa de Frango', ncm: '02071400', un: 'KG', pv: 11.90, est: 70, sec: 'Açougue', peso: true },
    { d: 'Linguiça Toscana', ncm: '16010000', un: 'KG', pv: 18.90, est: 40, sec: 'Açougue', peso: true },
    { d: 'Costela Bovina', ncm: '02012000', un: 'KG', pv: 26.90, est: 30, sec: 'Açougue', peso: true },
    { d: 'Bisteca Suína', ncm: '02031900', un: 'KG', pv: 19.90, est: 35, sec: 'Açougue', peso: true },
    { d: 'Frango Inteiro Congelado', ncm: '02071200', un: 'KG', pv: 12.90, est: 50, sec: 'Açougue', peso: true },
    { d: 'Carne Moída de Segunda', ncm: '02013000', un: 'KG', pv: 24.90, est: 45, sec: 'Açougue', peso: true },
  ];

  let idx = 0;
  for (const p of catalogo) {
    idx++;
    const codigo = 'M' + String(idx).padStart(4, '0');
    // Balança usa prefixo 2; demais recebem um EAN-13 de exemplo com prefixo 789.
    const barras = p.peso
      ? '2' + String(idx).padStart(12, '0')
      : '789' + String(1000000000 + idx);
    const custo = +(p.pv * 0.72).toFixed(2);
    const prod = await prisma.produto.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo } },
      update: { precoVenda: p.pv, precoCusto: custo, descricao: p.d, categoria: p.sec, vendidoPorPeso: !!p.peso },
      create: {
        tenantId: tenant.id,
        codigo,
        codigoBarras: barras,
        descricao: p.d,
        ncm: p.ncm,
        cfop: '5102',
        unidadeMedidaId: umMap[p.un] || umMap['UN'],
        categoria: p.sec,
        precoVenda: p.pv,
        precoCusto: custo,
        estoqueMinimo: p.peso ? 5 : 10,
        vendidoPorPeso: !!p.peso,
      },
    });
    // saldo de estoque na filial
    const saldoExistente = await prisma.estoqueSaldo.findFirst({
      where: { tenantId: tenant.id, filialId: filial.id, produtoId: prod.id, loteId: null },
    });
    if (saldoExistente) {
      await prisma.estoqueSaldo.update({ where: { id: saldoExistente.id }, data: { quantidade: p.est } });
    } else {
      await prisma.estoqueSaldo.create({
        data: { tenantId: tenant.id, filialId: filial.id, produtoId: prod.id, quantidade: p.est },
      });
    }
  }
  console.log(`✅ ${catalogo.length} produtos de varejo criados com saldo de estoque`);

  console.log('\n🎉 Seed concluído com sucesso!\n');
  console.log('─────────────────────────────────────');
  console.log('🔑 Credenciais de acesso (senha · PIN):');
  console.log('   Admin (dono)      → admin@mercado.com    / admin123    · PIN 1234 → Dashboard');
  console.log('   Gerente           → gerente@mercado.com  / gerente123  · PIN 2345 → Dashboard');
  console.log('   Operador de Caixa → caixa@mercado.com    / caixa123    · PIN 3456 → Caixa (PDV)');
  console.log('   Estoquista        → estoque@mercado.com  / estoque123  · PIN 4567 → Estoque');
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
