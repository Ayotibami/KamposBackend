const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
async function create() {
    await client.connect();
    try {
        await client.query('CREATE DATABASE kampos');
        console.log('Database kampos created');
    } catch (e) {
        console.log(e.message);
    }
    await client.end();
}
create();
