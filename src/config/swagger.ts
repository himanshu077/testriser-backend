import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import { BRANDING, EMAILS } from './branding';

/**
 * Swagger/OpenAPI Configuration
 *
 * Access the API documentation at: http://localhost:5000/api-docs
 */

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${BRANDING.APP_NAME_FULL} - API Documentation`,
      version: '1.0.0',
      description: `
        ${BRANDING.APP_DESCRIPTION}

        ## Authentication
        This API uses JWT Bearer token authentication.

        ### How to Authenticate:
        1. Login via POST /api/auth/sign-in with demo credentials
        2. Copy the **token** from the response (just the token, without "Bearer")
        3. Click the "Authorize" button (🔓) at the top right
        4. Paste ONLY the token (Swagger adds "Bearer" automatically)
        5. Click "Authorize" then "Close"

        ⚠️ IMPORTANT: Enter only the token, NOT "Bearer token"

        ### Demo Credentials:
        - **Admin**: ${EMAILS.ADMIN} / admin123
        - **Student**: ${EMAILS.DEMO_STUDENT} / student123

        ## Roles & Permissions
        - **Admin**: Full platform access (all admin/* routes)
        - **Student**: Student access (student/* routes)
        - Attempting to access routes without proper role returns 403 Forbidden
      `,
      contact: {
        name: 'API Support',
        email: EMAILS.SUPPORT,
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      ...(process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN
        ? [
            {
              url: process.env.CORS_ORIGIN,
              description: 'Production - Backend API Server',
            },
          ]
        : [
            {
              url: 'http://localhost:5000',
              description: 'Development - Local Backend Server',
            },
          ]),
    ],
    components: {
      securitySchemes: {
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `Admin JWT Token - Login as ${EMAILS.ADMIN} / admin123`,
        },
        studentAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `Student JWT Token - Login as ${EMAILS.DEMO_STUDENT} / student123`,
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: EMAILS.ADMIN,
            },
            name: {
              type: 'string',
              example: 'Admin User',
            },
            role: {
              type: 'string',
              enum: ['admin', 'student'],
              example: 'admin',
            },
          },
        },
        Lead: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '1',
            },
            name: {
              type: 'string',
              example: 'Sarah Johnson',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'sarah@example.com',
            },
            phone: {
              type: 'string',
              example: '90210',
            },
            status: {
              type: 'string',
              enum: ['New', 'Contacted', 'Booked', 'Closed'],
              example: 'New',
            },
            source: {
              type: 'string',
              example: 'Google Ads',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Unauthorized',
            },
            message: {
              type: 'string',
              example: 'Invalid or expired token',
            },
          },
        },
      },
    },
    // No default security - each route specifies its own
    security: [],
  },
  apis: ['./src/routes/*.ts', './src/server.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
