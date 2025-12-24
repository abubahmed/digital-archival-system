# Backend API

Express server for the digital archival system with SQLite database.

## Setup

```bash
npm install
```

## Configuration

Environment variables (optional):

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (default: http://localhost:3000)

## Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## API Routes

### Jobs

- `GET /jobs` - List all jobs (returns basic info, no logs)
- `POST /jobs` - Create/start a new archival job
- `GET /jobs/:jobId` - Get specific job details (includes logs)

## Database

SQLite database (`database.db`) is automatically created on first run.

- **jobs** table: Stores job metadata and configuration
- **logs** table: Stores log entries for each job (with foreign key relationship)

## Security Features

- Rate limiting (100 requests per 15 minutes per IP)
- Security headers (X-Content-Type-Options, X-Frame-Options)
- CORS configuration
- Request body size limits (10MB)
- Error handling with safe error messages

## Project Structure

```
backend/
├── index.js          # Main server entry point
├── config.js         # Configuration
├── db.js             # Database initialization
├── db/
│   ├── jobs.js       # Job database operations
│   └── logs.js       # Log database operations
└── routes/
    └── jobs.js       # Job API routes
```
