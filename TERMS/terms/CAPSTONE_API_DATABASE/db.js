// db.js
import mysql from 'mysql';

const database = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'capstone_database',
});

database.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database is connected');
  }
});

export default database;
