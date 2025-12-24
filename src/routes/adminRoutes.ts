import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';
import * as papersController from '../controllers/papersController';
import * as questionsController from '../controllers/questionsController';
import * as mockTestsController from '../controllers/mockTestsController';
import * as contactController from '../controllers/contactController';
import * as subjectsController from '../controllers/subjectsController';
import * as curriculumChaptersController from '../controllers/curriculumChaptersController';
import { uploadPDFBook, uploadDiagramImage } from '../middleware/upload';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate, requireAdmin);

// ============================================================================
// PAPERS ROUTES
// ============================================================================

/**
 * @swagger
 * /api/admin/papers:
 *   get:
 *     summary: Retrieve papers
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers', papersController.getAllPapers);
/**
 * @swagger
 * /api/admin/papers/pyq:
 *   get:
 *     summary: Retrieve pyq
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers/pyq', papersController.getPYQPapers);
/**
 * @swagger
 * /api/admin/papers/pyq/{year}/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers/pyq/:year/questions', papersController.getPYQPaperQuestions);
/**
 * @swagger
 * /api/admin/papers/{id}:
 *   get:
 *     summary: Retrieve papers
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers/:id', papersController.getPaperById);
/**
 * @swagger
 * /api/admin/papers:
 *   post:
 *     summary: Create papers
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/papers', papersController.createPaper);
/**
 * @swagger
 * /api/admin/papers/{id}:
 *   put:
 *     summary: Update papers
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.put('/papers/:id', papersController.updatePaper);
/**
 * @swagger
 * /api/admin/papers/{id}:
 *   delete:
 *     summary: Delete papers
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/papers/:id', papersController.deletePaper);
/**
 * @swagger
 * /api/admin/papers/{id}/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers/:id/questions', papersController.getPaperQuestions);
/**
 * @swagger
 * /api/admin/papers/{id}/publish:
 *   post:
 *     summary: Create publish
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/papers/:id/publish', papersController.publishPaper);

// ============================================================================
// QUESTIONS ROUTES
// ============================================================================

/**
 * @swagger
 * /api/admin/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/questions', questionsController.getAllQuestions);
/**
 * @swagger
 * /api/admin/questions/filter-options:
 *   get:
 *     summary: Retrieve filter-options
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/questions/filter-options', questionsController.getFilterOptions);
/**
 * @swagger
 * /api/admin/questions/{id}:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/questions/:id', questionsController.getQuestionById);
/**
 * @swagger
 * /api/admin/questions:
 *   post:
 *     summary: Create questions
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions', questionsController.createQuestion);
/**
 * @swagger
 * /api/admin/questions/bulk:
 *   post:
 *     summary: Create bulk
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/bulk', questionsController.bulkCreateQuestions);
/**
 * @swagger
 * /api/admin/questions/upload-pdf:
 *   post:
 *     summary: Create upload-pdf
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/upload-pdf', uploadPDFBook, questionsController.uploadPDFQuestions);
/**
 * @swagger
 * /api/admin/questions/{id}:
 *   put:
 *     summary: Update questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.put('/questions/:id', questionsController.updateQuestion);
/**
 * @swagger
 * /api/admin/questions/{id}:
 *   delete:
 *     summary: Delete questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/questions/:id', questionsController.deleteQuestion);
/**
 * @swagger
 * /api/admin/questions/{id}/upload-diagram:
 *   post:
 *     summary: Create upload-diagram
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post(
  '/questions/:id/upload-diagram',
  uploadDiagramImage,
  questionsController.uploadQuestionDiagram
);
/**
 * @swagger
 * /api/admin/questions/{id}/diagram:
 *   delete:
 *     summary: Delete diagram
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/questions/:id/diagram', questionsController.deleteQuestionDiagram);
/**
 * @swagger
 * /api/admin/questions/{id}/generate-diagram:
 *   post:
 *     summary: Create generate-diagram
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/:id/generate-diagram', questionsController.generateQuestionDiagram);
/**
 * @swagger
 * /api/admin/questions/{id}/crop-diagram:
 *   post:
 *     summary: Create crop-diagram
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/:id/crop-diagram', questionsController.cropQuestionDiagram);
/**
 * @swagger
 * /api/admin/questions/{id}/generate-explanation:
 *   post:
 *     summary: Create generate-explanation
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/:id/generate-explanation', questionsController.generateExplanation);
/**
 * @swagger
 * /api/admin/questions/auto-generate-diagrams:
 *   post:
 *     summary: Create auto-generate-diagrams
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/auto-generate-diagrams', questionsController.autoGenerateMissingDiagrams);

// Question review/approval routes
/**
 * @swagger
 * /api/admin/questions/pending/count:
 *   get:
 *     summary: Retrieve count
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/questions/pending/count', questionsController.getPendingCount);
/**
 * @swagger
 * /api/admin/questions/{id}/approve:
 *   patch:
 *     summary: Partially update approve
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.patch('/questions/:id/approve', questionsController.approveQuestion);
/**
 * @swagger
 * /api/admin/questions/{id}/reject:
 *   patch:
 *     summary: Partially update reject
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.patch('/questions/:id/reject', questionsController.rejectQuestion);
/**
 * @swagger
 * /api/admin/questions/bulk-approve:
 *   post:
 *     summary: Create bulk-approve
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/questions/bulk-approve', questionsController.bulkApproveQuestions);

// ============================================================================
// MOCK TESTS ROUTES
// ============================================================================

/**
 * @swagger
 * /api/admin/mock-tests:
 *   get:
 *     summary: Retrieve mock-tests
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/mock-tests', mockTestsController.getAllMockTests);
/**
 * @swagger
 * /api/admin/mock-tests/stats:
 *   get:
 *     summary: Retrieve stats
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/mock-tests/stats', mockTestsController.getMockTestStats);
/**
 * @swagger
 * /api/admin/mock-tests/generate:
 *   post:
 *     summary: Create generate
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/mock-tests/generate', mockTestsController.generateMockTest);
/**
 * @swagger
 * /api/admin/mock-tests/{id}:
 *   get:
 *     summary: Retrieve mock-tests
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/mock-tests/:id', mockTestsController.getMockTestById);
/**
 * @swagger
 * /api/admin/mock-tests:
 *   post:
 *     summary: Create mock-tests
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/mock-tests', mockTestsController.createMockTest);
/**
 * @swagger
 * /api/admin/mock-tests/{id}/questions:
 *   post:
 *     summary: Create questions
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/mock-tests/:id/questions', mockTestsController.addQuestionsToMockTest);
/**
 * @swagger
 * /api/admin/mock-tests/{id}/regenerate:
 *   post:
 *     summary: Create regenerate
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/mock-tests/:id/regenerate', mockTestsController.regenerateMockTestQuestions);
/**
 * @swagger
 * /api/admin/mock-tests/{id}/questions:
 *   delete:
 *     summary: Delete questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/mock-tests/:id/questions', mockTestsController.clearMockTestQuestions);
/**
 * @swagger
 * /api/admin/mock-tests/{id}:
 *   put:
 *     summary: Update mock-tests
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.put('/mock-tests/:id', mockTestsController.updateMockTest);
/**
 * @swagger
 * /api/admin/mock-tests/{id}:
 *   delete:
 *     summary: Delete mock-tests
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/mock-tests/:id', mockTestsController.deleteMockTest);
/**
 * @swagger
 * /api/admin/mock-tests/{id}/publish:
 *   post:
 *     summary: Create publish
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/mock-tests/:id/publish', mockTestsController.publishMockTest);

// ============================================================================
// CONTACT MESSAGES ROUTES
// ============================================================================

/**
 * @swagger
 * /api/admin/contact-messages:
 *   get:
 *     summary: Retrieve contact-messages
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/contact-messages', contactController.getAllContactMessages);
/**
 * @swagger
 * /api/admin/contact-messages/{id}/read:
 *   put:
 *     summary: Update read
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.put('/contact-messages/:id/read', contactController.markMessageAsRead);
/**
 * @swagger
 * /api/admin/contact-messages/{id}:
 *   delete:
 *     summary: Delete contact-messages
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/contact-messages/:id', contactController.deleteContactMessage);

// ============================================================================
// SUBJECTS ROUTES
// ============================================================================

/**
 * @swagger
 * /api/admin/subjects:
 *   get:
 *     summary: Retrieve subjects
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/subjects', subjectsController.getAllSubjects);
/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   get:
 *     summary: Retrieve subjects
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/subjects/:id', subjectsController.getSubjectById);
/**
 * @swagger
 * /api/admin/subjects:
 *   post:
 *     summary: Create subjects
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/subjects', subjectsController.createSubject);
/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   patch:
 *     summary: Partially update subjects
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.patch('/subjects/:id', subjectsController.updateSubject);
/**
 * @swagger
 * /api/admin/subjects/{id}:
 *   delete:
 *     summary: Delete subjects
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/subjects/:id', subjectsController.deleteSubject);
/**
 * @swagger
 * /api/admin/subjects/reorder:
 *   put:
 *     summary: Update reorder
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.put('/subjects/reorder', subjectsController.reorderSubjects);

// ============================================================================
// CURRICULUM CHAPTERS ROUTES
// ============================================================================

// CRUD operations
/**
 * @swagger
 * /api/admin/curriculum-chapters:
 *   get:
 *     summary: Retrieve curriculum-chapters
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/curriculum-chapters', curriculumChaptersController.getAllChapters);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}:
 *   get:
 *     summary: Retrieve curriculum-chapters
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/curriculum-chapters/:id', curriculumChaptersController.getChapterById);
/**
 * @swagger
 * /api/admin/curriculum-chapters:
 *   post:
 *     summary: Create curriculum-chapters
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/curriculum-chapters', curriculumChaptersController.createChapter);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}:
 *   patch:
 *     summary: Partially update curriculum-chapters
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.patch('/curriculum-chapters/:id', curriculumChaptersController.updateChapter);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}:
 *   delete:
 *     summary: Delete curriculum-chapters
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/curriculum-chapters/:id', curriculumChaptersController.deleteChapter);

// Question mapping
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/curriculum-chapters/:id/questions', curriculumChaptersController.getChapterQuestions);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/map-question:
 *   post:
 *     summary: Create map-question
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post(
  '/curriculum-chapters/:id/map-question',
  curriculumChaptersController.mapQuestionToChapter
);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/unmap-question:
 *   post:
 *     summary: Create unmap-question
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post(
  '/curriculum-chapters/:id/unmap-question',
  curriculumChaptersController.unmapQuestionFromChapter
);
/**
 * @swagger
 * /api/admin/curriculum-chapters/auto-map:
 *   post:
 *     summary: Create auto-map
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/curriculum-chapters/auto-map', curriculumChaptersController.autoMapQuestions);
/**
 * @swagger
 * /api/admin/curriculum-chapters/mapping/uncertain:
 *   get:
 *     summary: Retrieve uncertain
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get(
  '/curriculum-chapters/mapping/uncertain',
  curriculumChaptersController.getUncertainMappings
);
/**
 * @swagger
 * /api/admin/curriculum-chapters/mapping/report:
 *   get:
 *     summary: Retrieve report
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/curriculum-chapters/mapping/report', curriculumChaptersController.getMappingReport);

// Status management
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/publish:
 *   post:
 *     summary: Create publish
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/curriculum-chapters/:id/publish', curriculumChaptersController.publishChapter);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/archive:
 *   post:
 *     summary: Create archive
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/curriculum-chapters/:id/archive', curriculumChaptersController.archiveChapter);
/**
 * @swagger
 * /api/admin/curriculum-chapters/{id}/refresh-stats:
 *   post:
 *     summary: Create refresh-stats
 *     tags: [Admin]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post(
  '/curriculum-chapters/:id/refresh-stats',
  curriculumChaptersController.refreshChapterStats
);

export default router;
