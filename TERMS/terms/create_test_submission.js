// Simple script to create a test MPS submission
// Run this with: node create_test_submission.js

const mysql = require('mysql');

// Database connection
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

  // Create a test MPS submission
  const testSubmission = {
    category_id: 3, // Assuming 3 is MPS category
    submitted_by: 1, // Assuming user ID 1 exists
    status: 1, // Pending status
    number_of_submission: 1,
    value: 'Test MPS Report',
    fields: JSON.stringify({
      type: 'MPS',
      grade: 1,
      rows: [
        { trait: 'Masipag', m: 1, f: 2, total: 3, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 },
        { trait: 'Matulungin', m: 1, f: 17, total: 18, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 },
        { trait: 'Masunurin', m: 1, f: 1, total: 2, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 },
        { trait: 'Magalang', m: 1, f: 1, total: 2, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 },
        { trait: 'Matapat', m: 1, f: 1, total: 2, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 },
        { trait: 'Matiyaga', m: 1, f: 1, total: 2, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 }
      ],
      totals: { m: 6, f: 23, total: 29, total_score: 0, mean: 0, median: 0, pl: 0, mps: 0, sd: 0, target: 0, hs: 0, ls: 0 }
    })
  };

  const sql = `INSERT INTO submission (category_id, submitted_by, status, number_of_submission, value, fields, date_submitted) 
               VALUES (?, ?, ?, ?, ?, ?, NOW())`;

  connection.query(sql, [
    testSubmission.category_id,
    testSubmission.submitted_by,
    testSubmission.status,
    testSubmission.number_of_submission,
    testSubmission.value,
    testSubmission.fields
  ], (err, result) => {
    if (err) {
      console.error('Error creating test submission:', err);
    } else {
      console.log('Test submission created with ID:', result.insertId);
      console.log('You can now test with URL: http://localhost:5173/MPSReport?id=' + result.insertId);
    }
    connection.end();
  });
});

