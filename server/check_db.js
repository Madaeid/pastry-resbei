import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

client.connect()
  .then(() => client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subscriptions'"
  ))
  .then(res => {
    console.table(res.rows);
    client.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    client.end();
  });
