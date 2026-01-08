const { Client } = require('pg');

const creds = [
    'postgres://postgres:postgres@localhost:5432/kampos',
    'postgres://postgres:password@localhost:5432/kampos',
    'postgres://postgres:123456@localhost:5432/kampos',
    'postgres://postgres:admin@localhost:5432/kampos',
    'postgres://postgres@localhost:5432/kampos',
];

async function check() {
    for (const uri of creds) {
        console.log(`Trying ${uri}...`);
        const client = new Client({ connectionString: uri });
        try {
            await client.connect();
            console.log(`SUCCESS: ${uri}`);
            await client.end();
            process.exit(0);
        } catch (e) {
            if (e.message.includes('database "kampos" does not exist')) {
                console.log(`Auth SUCCESS but DB missing: ${uri}`);
                process.exit(0);
            }
            console.log(`Failed: ${e.message}`);
            try { await client.end(); } catch { }
        }
    }
}
check();
