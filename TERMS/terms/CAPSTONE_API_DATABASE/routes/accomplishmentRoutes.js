import express from "express";
import multer from "multer";
import {
  giveAccomplishmentReport,
  getAccomplishmentSubmission,
  patchAccomplishmentSubmission
} from "../controllers/accomplishmentController.js";

const router = express.Router();

/** Multer: store files under uploads/accomplishments/ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/accomplishments"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/** Seed blank submissions for recipients */
router.post("/give", giveAccomplishmentReport);

/** Read a single submission (fields parsed) */
router.get("/:id", getAccomplishmentSubmission);

/** Update narrative + (optionally) add/remove images */
router.patch("/:id", upload.array("images"), patchAccomplishmentSubmission);

export default router;
