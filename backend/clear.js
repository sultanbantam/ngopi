const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_KZamupngj61q@ep-cool-credit-ao1qc493-pooler.c-2.ap-southeast-1.aws.neon.tech/bamboochat?sslmode=require";

async function main() {
  const client = new Client({
    connectionString,
  });
  await client.connect();
  
  const res = await client.query("UPDATE \"User\" SET avatar_url = '' WHERE avatar_url LIKE 'data:image%'");
  console.log(`Berhasil menghapus ${res.rowCount} avatar Base64 lama.`);
  
  await client.end();
}

main().catch(console.error);
