# Digital Archival System - Backend

**Copyright © 2024-2025 The Daily Princetonian. All rights reserved.**

Express.js API server for the Digital Archival System with SQLite database. This backend service manages archival job lifecycle, persistence, and provides real-time job status updates via Server-Sent Events.

## Overview

Express 5 application that provides a REST API for managing archival jobs. The backend maintains job state in a SQLite database and supports job creation, retrieval, and real-time monitoring. Jobs are tracked through states: `idle`, `running`, `success`, and `error`. The service implements rate limiting, CORS, and security headers for production use.

## System Requirements

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher (or compatible package manager: yarn, pnpm, bun)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (optional):

Create a `.env` file in the `backend/` directory:

```env
# Server port (default: 3001)
PORT=3001

# Environment (development/production)
NODE_ENV=development

# Comma-separated list of allowed CORS origins (default: http://localhost:3000)
ALLOWED_ORIGINS=http://localhost:3000
```

## Development

Start the development server with auto-reload:

```bash
npm run dev
```

The server will be accessible at `http://localhost:3001` by default (or the port specified in `PORT` environment variable).

## Production

Start the production server:

```bash
npm start
```

The production server runs on port 3001 by default. Configure the port using the `PORT` environment variable.

## Project Structure

```
backend/
├── index.js              # Main server entry point
├── db.js                 # Database initialization and schema
├── db/
│   ├── jobs.js          # Job database operations
│   └── logs.js          # Log database operations
├── routes/
│   └── jobs.js          # Job API routes
└── utils/
    ├── jobHelpers.js    # Job ID generation and utilities
    └── validation.js    # Request validation functions
```

## API Routes

- `GET /jobs` - Retrieve all jobs with logs
- `POST /jobs` - Create a new archival job (accepts job configuration in request body)
- `GET /jobs/:jobId` - Get specific job details with logs
- `GET /jobs/:jobId/stream` - Server-Sent Events stream for real-time job updates (5 second interval)

## Database

SQLite database (`database.db`) is automatically created on first run in the `db/` directory. The database schema includes:

- **jobs table**: Stores job metadata (jobId, createdAt, state, downloadUrl, source, archivalType)
- **logs table**: Stores log entries linked to jobs via foreign key (jobId, message, timestamp, level)

Database tables are created automatically if they don't exist. Data persists across server restarts.

## Technology Stack

- Express.js 5.2.1
- better-sqlite3 11.6.0
- express-rate-limit 7.1.5
- cors 2.8.5

## Security Features

- Rate limiting: 100 requests per 15 minutes per IP address
- CORS configuration with allowed origins
- Security headers: X-Content-Type-Options, X-Frame-Options
- Request body size limit: 10MB
- Error handling with safe error messages (stack traces only in development)

## Development Scripts

- `npm run dev` - Start development server with auto-reload (Node.js watch mode)
- `npm start` - Start production server

## License

Copyright © 2024-2025 The Daily Princetonian. All rights reserved.

This software is proprietary and confidential. Unauthorized use, copying, modification, or distribution is strictly prohibited without express written permission from The Daily Princetonian.
