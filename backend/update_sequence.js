const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_KZamupngj61q@ep-cool-credit-ao1qc493-pooler.c-2.ap-southeast-1.aws.neon.tech/bamboochat?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  // founder bmc_id = 0 (special: tampil sebagai @founder_bmc tanpa angka)
  await client.query("UPDATE \"User\" SET bmc_id = 0 WHERE username = 'founder'");
  // sultan bmc_id = 1 (tampil sebagai @sultan_bmc1)
  await client.query("UPDATE \"User\" SET bmc_id = 1 WHERE username = 'sultan'");
  console.log("Updated: founder=bmc0 (special), sultan=bmc1");
  
  const res = await client.query('SELECT username, bmc_id FROM "User" ORDER BY bmc_id');
  console.log(res.rows);
  
  await client.end();
}

main().catch(console.error);
