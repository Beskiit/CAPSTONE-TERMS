import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import usersRouter from './routes/users.js';
import reportAssignmentRouter from './routes/reportAssignment.js';
import categoryRouter from './routes/categoryRouter.js';
import db from './db.js'; 
import subCategoryRouter from './routes/subCategoryRouter.js';
const app = express();
const PORT = 5000;


app.use(cors());
app.use(express.json());

// all routes
app.use('/users', usersRouter);
app.use('/reports', reportAssignmentRouter);
app.use('/categories', categoryRouter);
app.use('/subcategories', subCategoryRouter);

app.get('/', (req, res) => {
  res.send('Welcome to the Capstone API');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
