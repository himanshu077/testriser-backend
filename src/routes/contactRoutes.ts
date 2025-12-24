import { Router } from 'express';
import * as contactController from '../controllers/contactController';

const router = Router();

// ============================================================================
// PUBLIC CONTACT ROUTE
// ============================================================================

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit contact form
 *     description: Public endpoint for users to submit contact messages
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the person contacting
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for response
 *                 example: john.doe@example.com
 *               phone:
 *                 type: string
 *                 description: Phone number (optional)
 *                 example: "+91 9876543210"
 *               subject:
 *                 type: string
 *                 description: Subject of the inquiry
 *                 example: Question about NEET preparation
 *               message:
 *                 type: string
 *                 description: Detailed message content
 *                 example: I would like to know more about the mock test features
 *     responses:
 *       201:
 *         description: Message submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Your message has been sent successfully. We will get back to you soon.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Missing required fields
 *                 required:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["name", "email", "subject", "message"]
 *       500:
 *         description: Server error
 */
router.post('/', contactController.submitContactForm);

export default router;
