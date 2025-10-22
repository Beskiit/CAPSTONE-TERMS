// routes/users.js
import express from "express";
import db from "../db.js";
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

/** GET /users/teacher-section/:userId  (any authenticated) */
router.get("/teacher-section/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        ts.user_id,
        ts.section_id,
        s.section,
        gl.grade_level,
        ts.role as teacher_role
      FROM teacher_section ts
      LEFT JOIN section s ON ts.section_id = s.section_id
      LEFT JOIN grade_level gl ON s.grade_level_id = gl.grade_level_id
      WHERE ts.user_id = ?
    `;
    
    const results = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (results.length === 0) {
      return res.status(404).json({ error: "Teacher section not found" });
    }
    
    const sectionData = results[0];
    res.json({
      user_id: sectionData.user_id,
      section_id: sectionData.section_id,
      section: sectionData.section,
      grade_level: sectionData.grade_level,
      teacher_role: sectionData.teacher_role
    });
  } catch (error) {
    console.error("Error fetching teacher section:", error);
    res.status(500).json({ error: "Failed to fetch teacher section", details: error.message });
  }
});

export default router;
