import express from 'express';
import { createUser, getUser, getUsers, deleteUser, patchUser } from '../controllers/usersCon.js';

const router = express.Router();

// Routes handled
router.get('/', getUsers);         // GET /users
router.get('/:id', getUser);       // GET /users/:id
router.post('/', createUser);      // POST /users
router.delete('/:id', deleteUser); // DELETE /users/:id
router.patch('/:id', patchUser);   // PATCH /users/:id

export default router;
