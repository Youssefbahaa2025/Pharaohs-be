const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool using DATABASE_URL if available or individual parameters
let config;

if (process.env.DATABASE_URL) {
  // Parse the DATABASE_URL
  config = { uri: process.env.DATABASE_URL };
} else {
  // Use individual parameters
  config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pharaohs',
    port: process.env.DB_PORT || 3306
  };
}

// Add common configuration options
config = {
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

const pool = mysql.createPool(config);

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('📊 Database connection successful');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

module.exports = pool;
