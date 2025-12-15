# TestRiser Backend

Express.js + TypeScript API for the TestRiser NEET exam preparation platform.

## Tech Stack

- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT tokens
- **API Documentation:** Swagger/OpenAPI
- **AI Integrations:** Claude SDK, Google Generative AI, OpenAI

## Getting Started

### Prerequisites

- Node.js 20.9.0 or higher
- PostgreSQL 14+ (or use Supabase/AWS RDS)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/himanshu077/testriser-backend.git
cd testriser-backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS
- `CORS_ORIGIN` - Allowed CORS origin

### Database Setup

1. Create the database and run migrations:
```bash
npm run db:push
```

2. Seed the database with demo data:
```bash
npm run seed
```

### Development

Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

### Building

Build for production:
```bash
npm run build
```

Start the production server:
```bash
npm run start
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run db:generate` - Generate database migration
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run pending migrations
- `npm run seed` - Seed database with demo data

## Project Structure

```
src/
├── config/           # Configuration (database, constants, Swagger)
├── controllers/      # Request handlers
│   ├── auth.ts
│   ├── papers.ts
│   ├── questions.ts
│   ├── mockTests.ts
│   └── ...
├── middleware/       # Express middleware
│   ├── auth.ts
│   ├── performance.ts
│   └── fileUploads.ts
├── models/           # Drizzle ORM schema definitions
├── routes/           # API route definitions
├── scripts/          # Database scripts, seeding, migrations
├── utils/            # Helper functions
└── server.ts         # Application entry point

drizzle/              # Database migrations
```

## API Documentation

Once the server is running, access the interactive API documentation at:
- Swagger UI: `http://localhost:5000/api-docs`

## Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `FRONTEND_URL` - Frontend application URL
- `CORS_ORIGIN` - Allowed CORS origin

### Optional

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment mode (development/production)
- `JWT_EXPIRES_IN` - JWT token expiration (default: 7d)

## Database Migrations

When you modify the database schema in `src/models/schema.ts`:

1. Generate a migration:
```bash
npm run db:generate
```

2. Review the generated migration in `drizzle/` directory

3. Apply the migration:
```bash
npm run db:migrate
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run type-check and lint: `npm run type-check && npm run lint`
4. If you modified the schema, generate a migration
5. Commit your changes (including migration files)
6. Push and create a pull request

## Deployment

This repository is automatically deployed when changes are pushed to `main`. The main deployment repository ([testriser](https://github.com/himanshu077/testriser)) will be notified and trigger a deployment to AWS EC2.

## License

Private - All Rights Reserved
