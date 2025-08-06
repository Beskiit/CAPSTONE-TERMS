import express from 'express';
import { getSubCategoriesByCategoryId } from '../controllers/subcategories.js';

const router = express.Router();

router.get('/:categoryId', getSubCategoriesByCategoryId);

export default router;
