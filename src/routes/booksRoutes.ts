import { Router } from 'express';
import { authenticate, authenticateSSE, requireRole } from '../middleware/authMiddleware';
import { uploadPDFBook } from '../middleware/upload';
import {
  uploadBook,
  getBooks,
  getBookById,
  getBookQuestions,
  updateBook,
  deleteBook,
  retryProcessing,
  streamBookProgress,
  getBookExtractionReport,
  getBookPages,
  retryPages,
  smartRetry,
  retrySection,
} from '../controllers/booksController';
import { extractAnswerKey, applyAnswerKey } from '../controllers/answerKeyController';

const router = Router();

/**
 * Books Management Routes
 * All routes require admin authentication
 */

// Upload new PDF book
// POST /api/admin/books/upload
/**
 * @swagger
 * /api/admin/books/upload:
 *   post:
 *     summary: Create upload
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/upload', authenticate, requireRole(['admin']), uploadPDFBook, uploadBook);

// Get all books with filtering and pagination
// GET /api/admin/books?status=pending&subject=physics&page=1&limit=10
/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Retrieve books
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/', authenticate, requireRole(['admin']), getBooks);

// Get single book by ID
// GET /api/admin/books/:id
/**
 * @swagger
 * /api/admin/books/{id}:
 *   get:
 *     summary: Retrieve books
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/:id', authenticate, requireRole(['admin']), getBookById);

// Get questions for a specific book
// GET /api/admin/books/:id/questions
/**
 * @swagger
 * /api/admin/books/{id}/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/:id/questions', authenticate, requireRole(['admin']), getBookQuestions);

// Update book details
// PATCH /api/admin/books/:id
/**
 * @swagger
 * /api/admin/books/{id}:
 *   patch:
 *     summary: Partially update books
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.patch('/:id', authenticate, requireRole(['admin']), updateBook);

// Delete book and associated questions
// DELETE /api/admin/books/:id
/**
 * @swagger
 * /api/admin/books/{id}:
 *   delete:
 *     summary: Delete books
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/:id', authenticate, requireRole(['admin']), deleteBook);

// Retry processing a failed book
// POST /api/admin/books/:id/retry
/**
 * @swagger
 * /api/admin/books/{id}/retry:
 *   post:
 *     summary: Create retry
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/retry', authenticate, requireRole(['admin']), retryProcessing);

// Stream book progress updates (Server-Sent Events)
// GET /api/admin/books/:id/progress/stream?token=xxx
// Note: Uses query parameter auth because EventSource cannot send custom headers
/**
 * @swagger
 * /api/admin/books/{id}/progress/stream:
 *   get:
 *     summary: Retrieve stream
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/:id/progress/stream', authenticateSSE, requireRole(['admin']), streamBookProgress);

// Get comprehensive extraction report for a book
// GET /api/admin/books/:id/extraction-report
/**
 * @swagger
 * /api/admin/books/{id}/extraction-report:
 *   get:
 *     summary: Retrieve extraction-report
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/:id/extraction-report', authenticate, requireRole(['admin']), getBookExtractionReport);

// Get all pages with images for preview mode
// GET /api/admin/books/:id/pages
/**
 * @swagger
 * /api/admin/books/{id}/pages:
 *   get:
 *     summary: Retrieve pages
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/:id/pages', authenticate, requireRole(['admin']), getBookPages);

// Retry specific pages
// POST /api/admin/books/:id/retry-pages
/**
 * @swagger
 * /api/admin/books/{id}/retry-pages:
 *   post:
 *     summary: Create retry-pages
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/retry-pages', authenticate, requireRole(['admin']), retryPages);

// Smart retry (analyzes and recommends best strategy)
// POST /api/admin/books/:id/smart-retry
/**
 * @swagger
 * /api/admin/books/{id}/smart-retry:
 *   post:
 *     summary: Create smart-retry
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/smart-retry', authenticate, requireRole(['admin']), smartRetry);

// Retry specific section
// POST /api/admin/books/:id/retry-section
/**
 * @swagger
 * /api/admin/books/{id}/retry-section:
 *   post:
 *     summary: Create retry-section
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/retry-section', authenticate, requireRole(['admin']), retrySection);

// Extract answer key from a specific page
// POST /api/admin/books/:id/extract-answer-key
/**
 * @swagger
 * /api/admin/books/{id}/extract-answer-key:
 *   post:
 *     summary: Create extract-answer-key
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/extract-answer-key', authenticate, requireRole(['admin']), extractAnswerKey);

// Apply extracted answer key to questions
// POST /api/admin/books/:id/apply-answer-key
/**
 * @swagger
 * /api/admin/books/{id}/apply-answer-key:
 *   post:
 *     summary: Create apply-answer-key
 *     tags: [Books]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/:id/apply-answer-key', authenticate, requireRole(['admin']), applyAnswerKey);

export default router;
