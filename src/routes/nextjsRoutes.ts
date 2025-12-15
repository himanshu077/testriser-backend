/**
 * Next.js Private API Routes Documentation
 *
 * WARNING: These routes are served by Next.js, NOT this Express backend
 *
 * Local:      http://localhost:3000/api/private/*
 * Production: http://3.137.53.219/api/private/* (through Nginx -> Next.js:3000)
 *
 * These use the same JWT tokens from Express backend authentication.
 *
 * NOTE: This is documentation-only. Actual implementation is in
 * frontend/src/app/api/private/ routes
 *
 * Swagger Try it out now works with CORS enabled on Next.js APIs
 */

/**
 * @swagger
 * tags:
 *   - name: Next.js Private APIs
 *     description: |
 *       Private server-side APIs in Next.js (requires JWT token)
 *
 *       WARNING: These APIs are served by Next.js, not Express backend
 *       - Local: http://localhost:3000/api/private/*
 *       - Production: Use frontend URL + /api/private/*
 *
 *       Swagger "Try it out" works with CORS enabled
 */

/**
 * @swagger
 * /api/private/example:
 *   get:
 *     summary: Example private API route (Next.js)
 *     description: |
 *       Test route to verify JWT authentication works in Next.js
 *
 *       Served by Next.js, not Express backend
 *       - Local: http://localhost:3000/api/private/example
 *       - Production: http://3.137.53.219/api/private/example
 *     tags: [Next.js Private APIs]
 *     security:
 *       - adminAuth: []
 *       - buyerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: This is a private API route
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Post data to private API (Next.js)
 *     description: |
 *       Example POST endpoint with JWT authentication
 *
 *       Served by Next.js, not Express backend
 *     tags: [Next.js Private APIs]
 *     security:
 *       - adminAuth: []
 *       - buyerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 example: Test data
 *     responses:
 *       200:
 *         description: Data received
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/private/admin/stats:
 *   get:
 *     summary: Get admin statistics (Admin only) (Next.js)
 *     description: |
 *       Retrieve platform-wide statistics. Requires admin role.
 *
 *       Served by Next.js, not Express backend
 *     tags: [Next.js Private APIs]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Admin stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin stats
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                       example: 150
 *                     totalLeads:
 *                       type: number
 *                       example: 1250
 *                     totalRevenue:
 *                       type: number
 *                       example: 45000
 *                     activeSubscriptions:
 *                       type: number
 *                       example: 85
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Forbidden
 *                 message:
 *                   type: string
 *                   example: Required role admin. Your role buyer
 */

/**
 * @swagger
 * /api/private/buyer/leads:
 *   get:
 *     summary: Get buyer leads (Buyer only) (Next.js)
 *     description: |
 *       Retrieve leads for the authenticated buyer. Requires buyer role.
 *
 *       Served by Next.js, not Express backend
 *     tags: [Next.js Private APIs]
 *     security:
 *       - buyerAuth: []
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Your leads
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 leads:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Requires buyer role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new lead (Buyer only) (Next.js)
 *     description: |
 *       Create a new lead for the authenticated buyer
 *
 *       Served by Next.js, not Express backend
 *     tags: [Next.js Private APIs]
 *     security:
 *       - buyerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               status:
 *                 type: string
 *                 enum: [new, contacted, booked, closed]
 *                 example: new
 *     responses:
 *       200:
 *         description: Lead created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lead created successfully
 *                 lead:
 *                   $ref: '#/components/schemas/Lead'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Requires buyer role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// This file is for documentation only - no actual routes exported
export {};
