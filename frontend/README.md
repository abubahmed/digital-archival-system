# Digital Archival System - Frontend

**Copyright © 2024-2025 The Daily Princetonian. All rights reserved.**

Web application frontend for the Digital Archival System, implemented using Next.js and React. This application provides the user interface and API proxy layer for managing archival jobs that capture and preserve content from The Daily Princetonian's official media channels and articles.

## Overview

Next.js 15 application with React 19 that provides a user interface for managing archival jobs. The frontend serves as both a client interface and API proxy layer, communicating with a backend service to manage archival operations for multiple content sources:

- Daily Princetonian website articles and newsletters
- Social media platforms (Instagram, Twitter/X, TikTok)
- Combined issues

The application supports four archival job types: single day, date range, URL-based, and most recent. Real-time job monitoring is implemented via Server-Sent Events (SSE), with job states tracked as `idle`, `running`, `success`, or `error`. Authentication uses Bearer tokens with optional localStorage persistence.

## System Requirements

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher (or compatible package manager: yarn, pnpm, bun)
- Backend API service must be running and accessible (see [backend documentation](../backend/README.md) for setup instructions)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (optional):

Create a `.env.local` file in the `frontend/` directory:

```env
# Backend API URL (required if backend is on a different origin)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001

# Base URL for metadata (optional, defaults to http://localhost:3000)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Development Environment

To start the development server with hot module replacement:

```bash
npm run dev
```

The development server will be accessible at `http://localhost:3000` by default. The development build utilizes Next.js Turbopack for improved build performance and fast refresh capabilities.

## Production Build

Generate an optimized production build:

```bash
npm run build
```

The build process performs code optimization, tree-shaking, and generates static assets. After a successful build, start the production server:

```bash
npm start
```

The production server runs on port 3000 by default. Configure the port using the `PORT` environment variable if required.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router directory
│   ├── api/               # API routes (proxies to backend)
│   │   └── jobs/         # Job management endpoints
│   ├── layout.tsx        # Root layout with metadata
│   ├── page.tsx          # Main application page
│   └── globals.css       # Global styles
├── components/           # React components
│   └── RadioCard.tsx    # Radio card component
├── utils/               # Utility functions
│   ├── dateHelpers.ts   # Date manipulation utilities
│   ├── httpClient.ts    # HTTP client for API calls
│   ├── logHelpers.ts    # Log formatting utilities
│   ├── urlHelpers.ts    # URL normalization utilities
│   └── validation.ts    # Form validation utilities
├── types.ts             # TypeScript type definitions
└── package.json         # Dependencies and scripts
```

## API Routes

Next.js API routes in `app/api/` proxy requests to the backend service:

- `GET /api/jobs` - Retrieve all jobs
- `POST /api/jobs` - Create a new archival job (accepts `ArchivalConfig` body)
- `GET /api/jobs/[jobId]` - Get specific job details with logs
- `GET /api/jobs/[jobId]/stream` - Server-Sent Events stream for real-time logs

## Usage

### Creating Jobs

1. Select content source (dailyPrince, newsletter, instagram, twitter, tiktok, dailyPrinceIssues)
2. Choose archival type (single day, date range, URLs, or most recent)
3. Configure parameters specific to the selected type
4. Provide authentication token if required (optional localStorage persistence)
5. Submit to create and start the job

### Monitoring Jobs

The job list displays all archival jobs. Select a job to view:

- Job metadata and current state
- Real-time log stream (for active jobs)
- Download URL (upon successful completion)

### Archival Types

- **Single Day**: Archive content from a specific date with optional time windows (HH:MM format)
- **Date Range**: Archive content across a date range with start/end times
- **URLs**: Process explicitly provided URLs (one per line, normalized and validated)
- **Most Recent**: Archive N most recent items since a specified date

## Technology Stack

- Next.js 15.5.0 (App Router)
- React 19.1.0
- TypeScript 5.x
- Tailwind CSS 4.x
- Server-Sent Events (SSE) for real-time updates

### Backend Integration

API requests are proxied through Next.js API routes (server-side). If the backend is on a different origin, configure `NEXT_PUBLIC_BACKEND_API_URL` and ensure CORS allows requests from the frontend origin.

## Development Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

Copyright © 2024-2025 The Daily Princetonian. All rights reserved.

This software is proprietary and confidential. Unauthorized use, copying, modification, or distribution is strictly prohibited without express written permission from The Daily Princetonian.
