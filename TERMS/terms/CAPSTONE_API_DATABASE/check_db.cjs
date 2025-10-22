// Simple script to check database contents
const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'capstone_database'
});

connection.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to database');

  // Check submissions
  connection.query('SELECT submission_id, report_assignment_id, category_id, submitted_by, status, value FROM submission ORDER BY submission_id DESC LIMIT 10', (err, results) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Recent submissions:');
      console.table(results);
    }
    
    // Check categories
    connection.query('SELECT * FROM category', (err, categories) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\nCategories:');
        console.table(categories);
      }
      
      // Check users
      connection.query('SELECT user_id, name, email, role FROM user_details LIMIT 5', (err, users) => {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log('\nUsers:');
          console.table(users);
        }
        
        connection.end();
      });
    });
  });
});
