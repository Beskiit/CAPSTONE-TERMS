// db.js
import mysql from 'mysql';
import dotenv from 'dotenv';

dotenv.config();

const database = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'capstone_database',
});

database.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database is connected');
  }
});

export default database;
