import { Router } from 'express';
import { authenticate, requireStudent } from '../middleware/authMiddleware';
import * as studentExamsController from '../controllers/studentExamsController';

const router = Router();

// All routes require authentication and student role
router.use(authenticate, requireStudent);

// ============================================================================
// STUDENT EXAM ROUTES
// ============================================================================

router.post('/exams/start', studentExamsController.startExam);
router.post('/exams/:examId/answer', studentExamsController.submitAnswer);
router.post('/exams/:examId/submit', studentExamsController.submitExam);
router.get('/exams/history', studentExamsController.getExamHistory);
router.get('/exams/:examId/result', studentExamsController.getExamResult);

export default router;
