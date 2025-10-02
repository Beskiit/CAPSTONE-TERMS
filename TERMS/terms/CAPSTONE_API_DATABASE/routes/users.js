import express from 'express';
import { createUser, getUser, getUsers, deleteUser, patchUser, getTeachers} from '../controllers/usersCon.js';
import { requireAuth, requireAdmin, requirePrincipal, requireOwnershipOrRole } from '../middleware/auth.js';

const router = express.Router();
const requireAnyRole = (roles) => (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (roles.map(r => r.toLowerCase()).includes(role)) return next();
  return res.status(403).json({ error: 'Forbidden' });
};
// Routes with proper authentication and authorization
router.get('/', requireAuth, requirePrincipal, getUsers);         // GET /users (Principal/Admin only)

router.get('/list/teachers', requireAuth, requireAnyRole(['principal','coordinator','admin']), getTeachers);

router.get('/:id', requireAuth, getUser);                        // GET /users/:id (Authenticated users)
router.post('/', requireAuth, requireAdmin, createUser);         // POST /users (Admin only)
router.delete('/:id', requireAuth, requireAdmin, deleteUser);    // DELETE /users/:id (Admin only)
router.patch('/:id', requireAuth, requireOwnershipOrRole(['admin']), patchUser); // PATCH /users/:id (Owner or Admin)

export default router;
