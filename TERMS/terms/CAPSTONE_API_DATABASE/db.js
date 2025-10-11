// db.js
import mysql from 'mysql';
import dotenv from 'dotenv';

dotenv.config();

// Use connection pool for better performance
const database = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'capstone_database',
  // Performance optimizations
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4',
  // Connection pool settings
  connectionLimit: 10,
  queueLimit: 0,
  // Additional optimizations
  multipleStatements: false,
  dateStrings: true
});

// Test the connection
database.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database pool connected successfully');
    connection.release();
  }
});

export default database;
