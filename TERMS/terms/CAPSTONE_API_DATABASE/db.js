// db.js
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

// Use connection pool for better performance
const database = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'capstone_database',
  // Performance / pool options compatible with mysql2
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Additional options
  multipleStatements: false,
  charset: 'utf8mb4',
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

// Initialize essential tables if they do not exist (lightweight, idempotent)
const initSql = `
  CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(64) DEFAULT NULL,
    ref_type VARCHAR(64) DEFAULT NULL,
    ref_id INT DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_ref (ref_type, ref_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

database.query(initSql, (err) => {
  if (err) {
    console.error('Failed to ensure notifications table exists:', err);
  }
});