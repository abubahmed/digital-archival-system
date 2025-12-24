# Backend API

Express server for the digital archival system.

## Setup

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

## Run

```bash
# Development
npm run dev

# Production
npm start
```

## API Routes

### Jobs

- `GET /jobs` - List all jobs
- `POST /jobs` - Create/start a new archival job
- `GET /jobs/:jobId` - Get specific job details

### Health

- `GET /health` - Health check

## Security Features

- Rate limiting (100 requests per 15 minutes per IP)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS configuration
- Request body size limits (10MB)
- Error handling with safe error messages

## Project Structure

```
backend/
├── index.js              # Main server entry point
├── config.js             # Configuration
├── middleware/
│   ├── auth.js          # Authentication middleware
│   ├── errorHandler.js  # Error handling
│   ├── security.js      # Security headers & rate limiting
│   └── validation.js # Request validation
└── routes/
    └── jobs.js          # Job routes
```
