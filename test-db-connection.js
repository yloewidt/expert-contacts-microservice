const { Pool } = require('pg');

async function testConnection() {
  const config = {
    host: '34.121.141.137',
    port: 5432,
    database: 'expert_contacts',
    user: 'app_user',
    password: 'ExpertC0ntacts2025!',
    max: 1,
    connectionTimeoutMillis: 10000,
  };

  console.log('Testing connection with config:', { ...config, password: '***' });

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    // Test query
    const result = await client.query('SELECT current_user, current_database()');
    console.log('Current user:', result.rows[0].current_user);
    console.log('Current database:', result.rows[0].current_database);
    
    // Test table access
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tablesResult.rows.map(r => r.table_name));
    
    // Test insert
    const testId = 'test-' + Date.now();
    const insertResult = await client.query(
      'INSERT INTO expert_sourcing_requests (id, project_description) VALUES ($1, $2) RETURNING id',
      [testId, 'Test project']
    );
    console.log('✅ Insert successful:', insertResult.rows[0].id);
    
    // Clean up
    await client.query('DELETE FROM expert_sourcing_requests WHERE id = $1', [testId]);
    console.log('✅ Cleanup successful');
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
  } finally {
    await pool.end();
  }
}

testConnection();