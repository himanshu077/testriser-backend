#!/usr/bin/env node

/**
 * Swagger Documentation Generator
 *
 * This script automatically generates Swagger JSDoc comments for all route files
 * by analyzing route definitions and their corresponding controllers.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROUTES_DIR = path.join(__dirname, '../src/routes');
const CONTROLLERS_DIR = path.join(__dirname, '../src/controllers');

// Route method to Swagger mapping
const METHOD_DESCRIPTIONS = {
  get: 'Retrieve',
  post: 'Create',
  put: 'Update',
  patch: 'Partially update',
  delete: 'Delete',
};

// Common response schemas
const COMMON_RESPONSES = {
  200: {
    description: 'Success',
    example: { success: true, data: {} },
  },
  201: {
    description: 'Created successfully',
    example: { success: true, data: {} },
  },
  400: {
    description: 'Bad request - Invalid input',
    example: { error: 'Bad Request', message: 'Invalid input' },
  },
  401: {
    description: 'Unauthorized - Authentication required',
    example: { error: 'Unauthorized', message: 'Authentication required' },
  },
  403: {
    description: 'Forbidden - Insufficient permissions',
    example: { error: 'Forbidden', message: 'Insufficient permissions' },
  },
  404: {
    description: 'Not found',
    example: { error: 'Not Found', message: 'Resource not found' },
  },
  500: {
    description: 'Server error',
    example: { error: 'Internal Server Error', message: 'Server error' },
  },
};

// Tag mapping based on route file names
const TAG_MAP = {
  authRoutes: 'Authentication',
  studentsRoutes: 'Students',
  contactRoutes: 'Contact',
  practiceRoutes: 'Practice',
  studentRoutes: 'Student Exams',
  subjectsRoutes: 'Subjects',
  booksRoutes: 'Books',
  examRoutes: 'Exams',
  adminRoutes: 'Admin',
  aiChatRoutes: 'AI Chat',
  chapterTestsRoutes: 'Chapter Tests',
  chaptersRoutes: 'Chapters',
  yearTestsRoutes: 'Year Tests',
};

/**
 * Parse route file to extract route definitions
 */
function parseRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  // Regex to match router.method('/path', middleware*, controller)
  const routeRegex =
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const [, method, path, handlers] = match;

    // Extract controller function name (last handler)
    const handlerParts = handlers.split(',').map((h) => h.trim());
    const controllerCall = handlerParts[handlerParts.length - 1];

    // Check if it has middleware (authenticate, requireAdmin, etc.)
    const hasAuth = handlers.includes('authenticate') || handlers.includes('dualAuth');
    const requiresAdmin = handlers.includes('requireAdmin');

    routes.push({
      method: method.toLowerCase(),
      path,
      controller: controllerCall,
      hasAuth,
      requiresAdmin,
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return routes;
}

/**
 * Analyze controller function to extract parameters
 */
function analyzeController(controllerPath, controllerName) {
  try {
    const content = fs.readFileSync(controllerPath, 'utf8');

    // Find the controller function
    const funcRegex = new RegExp(
      `export\\s+async\\s+function\\s+${controllerName}[^{]*{([^}]+(?:{[^}]*}[^}]*)*)}`,
      's'
    );
    const match = content.match(funcRegex);

    if (!match) return null;

    const funcBody = match[1];

    // Extract req.body destructuring
    const bodyMatch = funcBody.match(/const\s+{\s*([^}]+)\s*}\s*=\s*req\.body/);
    const bodyParams = bodyMatch ? bodyMatch[1].split(',').map((p) => p.trim()) : [];

    // Extract req.params
    const paramsMatch = funcBody.match(/const\s+{\s*([^}]+)\s*}\s*=\s*req\.params/);
    const pathParams = paramsMatch ? paramsMatch[1].split(',').map((p) => p.trim()) : [];

    // Extract req.query
    const queryMatch = funcBody.match(/const\s+{\s*([^}]+)\s*}\s*=\s*req\.query/);
    const queryParams = queryMatch ? queryMatch[1].split(',').map((p) => p.trim()) : [];

    // Check for validation
    const hasValidation = funcBody.includes('if (!') || funcBody.includes('return res.status');

    return {
      bodyParams,
      pathParams,
      queryParams,
      hasValidation,
    };
  } catch (error) {
    console.warn(`Could not analyze controller ${controllerName}:`, error.message);
    return null;
  }
}

/**
 * Generate Swagger JSDoc for a route
 */
function generateSwaggerDoc(route, tag, controllerInfo) {
  const { method, path, hasAuth, requiresAdmin } = route;

  // Convert path params to Swagger format
  const swaggerPath = path.replace(/:(\w+)/g, '{$1}');

  // Generate summary
  const pathParts = path.split('/').filter((p) => p && !p.startsWith(':'));
  const resourceName = pathParts[pathParts.length - 1] || tag.toLowerCase();
  const summary = `${METHOD_DESCRIPTIONS[method] || method.toUpperCase()} ${resourceName}`;

  let doc = `/**\n * @swagger\n * /api${swaggerPath}:\n *   ${method}:\n`;
  doc += ` *     summary: ${summary}\n`;
  doc += ` *     tags: [${tag}]\n`;

  // Add security if authenticated
  if (hasAuth) {
    doc += ` *     security:\n`;
    if (requiresAdmin) {
      doc += ` *       - adminAuth: []\n`;
    } else {
      doc += ` *       - studentAuth: []\n`;
      doc += ` *       - adminAuth: []\n`;
    }
  }

  // Add parameters (path params)
  if (controllerInfo && controllerInfo.pathParams.length > 0) {
    doc += ` *     parameters:\n`;
    controllerInfo.pathParams.forEach((param) => {
      doc += ` *       - in: path\n`;
      doc += ` *         name: ${param}\n`;
      doc += ` *         required: true\n`;
      doc += ` *         schema:\n`;
      doc += ` *           type: string\n`;
      doc += ` *         description: ${param} identifier\n`;
    });
  }

  // Add query parameters
  if (controllerInfo && controllerInfo.queryParams.length > 0) {
    if (!controllerInfo.pathParams.length) {
      doc += ` *     parameters:\n`;
    }
    controllerInfo.queryParams.forEach((param) => {
      // Remove default values from param name
      const cleanParam = param.split('=')[0].trim();
      doc += ` *       - in: query\n`;
      doc += ` *         name: ${cleanParam}\n`;
      doc += ` *         schema:\n`;
      doc += ` *           type: string\n`;
      doc += ` *         description: ${cleanParam}\n`;
    });
  }

  // Add request body for POST/PUT/PATCH
  if (
    ['post', 'put', 'patch'].includes(method) &&
    controllerInfo &&
    controllerInfo.bodyParams.length > 0
  ) {
    doc += ` *     requestBody:\n`;
    doc += ` *       required: true\n`;
    doc += ` *       content:\n`;
    doc += ` *         application/json:\n`;
    doc += ` *           schema:\n`;
    doc += ` *             type: object\n`;
    doc += ` *             properties:\n`;

    controllerInfo.bodyParams.forEach((param) => {
      const cleanParam = param.split('=')[0].trim();
      doc += ` *               ${cleanParam}:\n`;
      doc += ` *                 type: string\n`;
    });
  }

  // Add responses
  doc += ` *     responses:\n`;

  // Success response
  if (method === 'post') {
    doc += ` *       201:\n`;
    doc += ` *         description: ${COMMON_RESPONSES[201].description}\n`;
  } else if (method === 'delete') {
    doc += ` *       200:\n`;
    doc += ` *         description: Deleted successfully\n`;
  } else {
    doc += ` *       200:\n`;
    doc += ` *         description: ${COMMON_RESPONSES[200].description}\n`;
  }

  // Add common error responses
  if (hasAuth) {
    doc += ` *       401:\n`;
    doc += ` *         description: ${COMMON_RESPONSES[401].description}\n`;

    if (requiresAdmin) {
      doc += ` *       403:\n`;
      doc += ` *         description: ${COMMON_RESPONSES[403].description}\n`;
    }
  }

  if (['put', 'patch', 'delete'].includes(method)) {
    doc += ` *       404:\n`;
    doc += ` *         description: ${COMMON_RESPONSES[404].description}\n`;
  }

  doc += ` *       500:\n`;
  doc += ` *         description: ${COMMON_RESPONSES[500].description}\n`;
  doc += ` */\n`;

  return doc;
}

/**
 * Insert Swagger docs into route file
 */
function insertSwaggerDocs(filePath, routes, tag) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Find controller file
  const controllerImportMatch = content.match(/from\s+['"]\.\.\/controllers\/([^'"]+)['"]/);
  const controllerFile = controllerImportMatch
    ? path.join(CONTROLLERS_DIR, controllerImportMatch[1] + '.ts')
    : null;

  // Process routes in reverse order to preserve line numbers
  routes.reverse().forEach((route) => {
    // Check if Swagger doc already exists
    const lineIndex = route.line - 1;
    const prevLines = lines.slice(Math.max(0, lineIndex - 15), lineIndex).join('\n');

    if (prevLines.includes('@swagger') && prevLines.includes(route.path.replace(/:/g, '{'))) {
      console.log(
        `  ⏭️  Skipping ${route.method.toUpperCase()} ${route.path} (already documented)`
      );
      return;
    }

    // Analyze controller
    let controllerInfo = null;
    if (controllerFile && fs.existsSync(controllerFile)) {
      const controllerName = route.controller.split('.').pop();
      controllerInfo = analyzeController(controllerFile, controllerName);
    }

    // Generate Swagger doc
    const swaggerDoc = generateSwaggerDoc(route, tag, controllerInfo);

    // Insert before the route definition
    lines.splice(lineIndex, 0, swaggerDoc);

    console.log(`  ✅ Added ${route.method.toUpperCase()} ${route.path}`);
  });

  // Write back to file
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

/**
 * Main function
 */
function main() {
  console.log('🚀 Swagger Documentation Generator\n');
  console.log('📁 Scanning routes directory:', ROUTES_DIR);
  console.log('');

  const routeFiles = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));

  let totalRoutes = 0;
  let processedFiles = 0;

  routeFiles.forEach((file) => {
    const filePath = path.join(ROUTES_DIR, file);
    const fileName = path.basename(file, '.ts');
    const tag = TAG_MAP[fileName] || fileName.replace('Routes', '');

    console.log(`\n📄 Processing: ${file}`);
    console.log(`   Tag: ${tag}`);

    const routes = parseRouteFile(filePath);

    if (routes.length === 0) {
      console.log('   ⚠️  No routes found');
      return;
    }

    console.log(`   Found ${routes.length} routes:`);
    insertSwaggerDocs(filePath, routes, tag);

    totalRoutes += routes.length;
    processedFiles++;
  });

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete!`);
  console.log(`   Files processed: ${processedFiles}`);
  console.log(`   Routes documented: ${totalRoutes}`);
  console.log('='.repeat(50));
  console.log('\n💡 Next steps:');
  console.log('   1. Review generated documentation');
  console.log('   2. Refine parameter descriptions');
  console.log('   3. Add example request/response bodies');
  console.log('   4. Test at http://localhost:5000/api-docs\n');
}

// Run the script
main();
