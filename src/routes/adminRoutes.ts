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

router.get('/papers', papersController.getAllPapers);
router.get('/papers/pyq', papersController.getPYQPapers);
router.get('/papers/pyq/:year/questions', papersController.getPYQPaperQuestions);
router.get('/papers/:id', papersController.getPaperById);
router.post('/papers', papersController.createPaper);
router.put('/papers/:id', papersController.updatePaper);
router.delete('/papers/:id', papersController.deletePaper);
router.get('/papers/:id/questions', papersController.getPaperQuestions);
router.post('/papers/:id/publish', papersController.publishPaper);

// ============================================================================
// QUESTIONS ROUTES
// ============================================================================

router.get('/questions', questionsController.getAllQuestions);
router.get('/questions/filter-options', questionsController.getFilterOptions);
router.get('/questions/:id', questionsController.getQuestionById);
router.post('/questions', questionsController.createQuestion);
router.post('/questions/bulk', questionsController.bulkCreateQuestions);
router.post('/questions/upload-pdf', uploadPDFBook, questionsController.uploadPDFQuestions);
router.put('/questions/:id', questionsController.updateQuestion);
router.delete('/questions/:id', questionsController.deleteQuestion);
router.post(
  '/questions/:id/upload-diagram',
  uploadDiagramImage,
  questionsController.uploadQuestionDiagram
);
router.delete('/questions/:id/diagram', questionsController.deleteQuestionDiagram);
router.post('/questions/:id/generate-diagram', questionsController.generateQuestionDiagram);
router.post('/questions/:id/crop-diagram', questionsController.cropQuestionDiagram);

// ============================================================================
// MOCK TESTS ROUTES
// ============================================================================

router.get('/mock-tests', mockTestsController.getAllMockTests);
router.get('/mock-tests/stats', mockTestsController.getMockTestStats);
router.post('/mock-tests/generate', mockTestsController.generateMockTest);
router.get('/mock-tests/:id', mockTestsController.getMockTestById);
router.post('/mock-tests', mockTestsController.createMockTest);
router.post('/mock-tests/:id/questions', mockTestsController.addQuestionsToMockTest);
router.post('/mock-tests/:id/regenerate', mockTestsController.regenerateMockTestQuestions);
router.delete('/mock-tests/:id/questions', mockTestsController.clearMockTestQuestions);
router.put('/mock-tests/:id', mockTestsController.updateMockTest);
router.delete('/mock-tests/:id', mockTestsController.deleteMockTest);
router.post('/mock-tests/:id/publish', mockTestsController.publishMockTest);

// ============================================================================
// CONTACT MESSAGES ROUTES
// ============================================================================

router.get('/contact-messages', contactController.getAllContactMessages);
router.put('/contact-messages/:id/read', contactController.markMessageAsRead);
router.delete('/contact-messages/:id', contactController.deleteContactMessage);

// ============================================================================
// SUBJECTS ROUTES
// ============================================================================

router.get('/subjects', subjectsController.getAllSubjects);
router.get('/subjects/:id', subjectsController.getSubjectById);
router.post('/subjects', subjectsController.createSubject);
router.patch('/subjects/:id', subjectsController.updateSubject);
router.delete('/subjects/:id', subjectsController.deleteSubject);
router.put('/subjects/reorder', subjectsController.reorderSubjects);

// ============================================================================
// CURRICULUM CHAPTERS ROUTES
// ============================================================================

// CRUD operations
router.get('/curriculum-chapters', curriculumChaptersController.getAllChapters);
router.get('/curriculum-chapters/:id', curriculumChaptersController.getChapterById);
router.post('/curriculum-chapters', curriculumChaptersController.createChapter);
router.patch('/curriculum-chapters/:id', curriculumChaptersController.updateChapter);
router.delete('/curriculum-chapters/:id', curriculumChaptersController.deleteChapter);

// Question mapping
router.get('/curriculum-chapters/:id/questions', curriculumChaptersController.getChapterQuestions);
router.post(
  '/curriculum-chapters/:id/map-question',
  curriculumChaptersController.mapQuestionToChapter
);
router.post(
  '/curriculum-chapters/:id/unmap-question',
  curriculumChaptersController.unmapQuestionFromChapter
);
router.post('/curriculum-chapters/auto-map', curriculumChaptersController.autoMapQuestions);
router.get(
  '/curriculum-chapters/mapping/uncertain',
  curriculumChaptersController.getUncertainMappings
);
router.get('/curriculum-chapters/mapping/report', curriculumChaptersController.getMappingReport);

// Status management
router.post('/curriculum-chapters/:id/publish', curriculumChaptersController.publishChapter);
router.post('/curriculum-chapters/:id/archive', curriculumChaptersController.archiveChapter);
router.post(
  '/curriculum-chapters/:id/refresh-stats',
  curriculumChaptersController.refreshChapterStats
);

export default router;
