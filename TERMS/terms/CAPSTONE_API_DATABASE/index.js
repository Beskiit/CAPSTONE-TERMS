import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mysql from 'mysql';
import usersRouter from './routes/users.js'; // <--- Correct route import

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
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

// Route mounting
app.use('/users', usersRouter); // <--- All /users requests go to the router

app.get('/', (req, res) => {
  res.send('Welcome to the Capstone API');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
