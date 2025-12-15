import { Router } from 'express';
import * as contactController from '../controllers/contactController';

const router = Router();

// ============================================================================
// PUBLIC CONTACT ROUTE
// ============================================================================

router.post('/', contactController.submitContactForm);

export default router;
