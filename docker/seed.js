import pg from 'pg';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const data = require('../src/imoveis.json');
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'imoveis',
  user: 'user',
  password: 'pass',
});

async function seed() {
  await client.connect();

  for (const im of data.imoveis) {
    await client.query(
      `INSERT INTO imoveis VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO NOTHING`,
      [
        im.id,
        im.tipo_imovel,
        im.imobiliaria_corretor,
        im.bairro,
        im.cidade,
        im.operacao,
        im.valores.aluguel,
        im.valores.venda,
        im.valores.condominio,
        im.valores.iptu,
        im.valores.iptu_estimado,
        im.valores.custo_mensal_total,
        im.garagem.vagas,
        im.garagem.detalhe,
        im.quintal_area_externa.tem,
        im.quintal_area_externa.observacao,
        im.quartos,
        im.banheiros,
        im.area_m2,
        im.aceita_pet,
        im.entrar_em_contato,
        im.a_verificar,
        im.observacoes,
        im.link,
      ]
    );
  }

  await client.end();
  console.log(`${data.imoveis.length} imóveis inseridos com sucesso.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
