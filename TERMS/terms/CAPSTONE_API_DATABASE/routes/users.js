// routes/users.js
import express from "express";
import {
  getTeachers,
  getCoordinators,
  createUser,
  getUsers,
  getUser,
  patchUser,
  deleteUser,
} from "../controllers/usersCon.js";

import {
  requireAuth,
  requireAdmin,
  requirePrincipal,
  requireOwnershipOrRole,
} from "../middleware/auth.js";

const router = express.Router();

// helper: allow any of these roles
const requireAnyRole = (roles) => (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase();
  if (roles.map(r => r.toLowerCase()).includes(role)) return next();
  return res.status(403).json({ error: "Forbidden" });
};

/** GET /users  (principal or admin) */
router.get(
  "/",
  requireAuth,
  requireAnyRole(["principal", "admin"]),
  getUsers
);

/** GET /users/teachers  (principal/coordinator/admin) */
router.get(
  "/teachers",
  requireAuth,
  requireAnyRole(["principal", "coordinator", "admin"]),
  getTeachers
);

/** GET /users/coordinators  (principal/admin) */
router.get(
  "/coordinators",
  requireAuth,
  requireAnyRole(["principal", "admin"]),
  getCoordinators
);

/** GET /users/:id  (any authenticated) */
router.get("/:id", requireAuth, getUser);

/** POST /users  (admin only) */
router.post("/", requireAuth, requireAdmin, createUser);

/** PATCH /users/:id  (owner or admin) */
router.patch(
  "/:id",
  requireAuth,
  requireOwnershipOrRole(["admin"]),
  patchUser
);

/** DELETE /users/:id  (admin only) */
router.delete("/:id", requireAuth, requireAdmin, deleteUser);

export default router;
