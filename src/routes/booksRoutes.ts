import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { uploadPDFBook } from '../middleware/upload';
import {
  uploadBook,
  getBooks,
  getBookById,
  getBookQuestions,
  updateBook,
  deleteBook,
  retryProcessing,
} from '../controllers/booksController';

const router = Router();

/**
 * Books Management Routes
 * All routes require admin authentication
 */

// Upload new PDF book
// POST /api/admin/books/upload
router.post('/upload', authenticate, requireRole(['admin']), uploadPDFBook, uploadBook);

// Get all books with filtering and pagination
// GET /api/admin/books?status=pending&subject=physics&page=1&limit=10
router.get('/', authenticate, requireRole(['admin']), getBooks);

// Get single book by ID
// GET /api/admin/books/:id
router.get('/:id', authenticate, requireRole(['admin']), getBookById);

// Get questions for a specific book
// GET /api/admin/books/:id/questions
router.get('/:id/questions', authenticate, requireRole(['admin']), getBookQuestions);

// Update book details
// PATCH /api/admin/books/:id
router.patch('/:id', authenticate, requireRole(['admin']), updateBook);

// Delete book and associated questions
// DELETE /api/admin/books/:id
router.delete('/:id', authenticate, requireRole(['admin']), deleteBook);

// Retry processing a failed book
// POST /api/admin/books/:id/retry
router.post('/:id/retry', authenticate, requireRole(['admin']), retryProcessing);

export default router;
