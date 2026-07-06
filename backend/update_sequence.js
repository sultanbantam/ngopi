const { Client } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_KZamupngj61q@ep-cool-credit-ao1qc493-pooler.c-2.ap-southeast-1.aws.neon.tech/bamboochat?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  const res = await client.query('SELECT username, bmc_id FROM "User"');
  console.log(res.rows);
  
  await client.query("UPDATE \"User\" SET bmc_id = 1 WHERE username = 'founder'");
  await client.query("UPDATE \"User\" SET bmc_id = 2 WHERE username = 'sultan'");
  console.log("Updated founder and sultan bmc_ids.");
  
  await client.end();
}

main().catch(console.error);
