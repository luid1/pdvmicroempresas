/**
 * Preenche endereços FICTÍCIOS nos clientes que estão sem endereço.
 * Rodar: npx ts-node prisma/seed-enderecos.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RUAS = [
  'Rua Funchal', 'Av. Brigadeiro Faria Lima', 'Rua Augusta', 'Av. Paulista', 'Rua Oscar Freire',
  'Av. Rebouças', 'Rua da Consolação', 'Av. Ibirapuera', 'Rua Vergueiro', 'Av. Santo Amaro',
  'Rua Domingos de Morais', 'Av. Jabaquara', 'Rua Teodoro Sampaio', 'Av. Cidade Jardim',
  'Rua Pamplona', 'Av. Brasil', 'Rua Haddock Lobo', 'Av. Nove de Julho', 'Rua Estados Unidos',
  'Av. Leonardo da Vinci', 'Rua Faustino Augusto Cesar', 'Rua Taquarucu', 'Rua Telmo Coelho Filho',
  'Rua Inajatuba', 'Rua Lourenço de Azevedo', 'Rua Doutor Paulo Leite de Oliveira',
];
const BAIRROS = [
  'Vila Olímpia', 'Pinheiros', 'Jardins', 'Itaim Bibi', 'Moema', 'Vila Mariana', 'Brooklin',
  'Vila Guarani', 'Vila Marari', 'Vila Albano', 'Saúde', 'Ipiranga', 'Jardim Paulista',
  'Bela Vista', 'Consolação', 'Santana', 'Tatuapé', 'Lapa', 'Perdizes', 'Vila Morse',
];
const CIDADES = [
  { cidade: 'São Paulo', uf: 'SP' }, { cidade: 'Guarulhos', uf: 'SP' },
  { cidade: 'Osasco', uf: 'SP' }, { cidade: 'São Bernardo do Campo', uf: 'SP' },
  { cidade: 'Santo André', uf: 'SP' }, { cidade: 'Arujá', uf: 'SP' },
];
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const cep = () => `0${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(100 + Math.random() * 899)}`;

async function main() {
  const clientes = await prisma.cliente.findMany({ select: { id: true, enderecoJson: true } });
  let atualizados = 0;
  for (const c of clientes) {
    const e: any = c.enderecoJson || {};
    if (e.rua && e.cidade) continue; // já tem endereço
    const cid = rnd(CIDADES);
    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        enderecoJson: {
          rua: rnd(RUAS),
          numero: String(Math.floor(50 + Math.random() * 1950)),
          bairro: rnd(BAIRROS),
          cidade: cid.cidade,
          uf: cid.uf,
          cep: cep(),
        },
      },
    });
    atualizados++;
  }
  console.log(`✅ ${atualizados} clientes receberam endereço fictício (de ${clientes.length}).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
