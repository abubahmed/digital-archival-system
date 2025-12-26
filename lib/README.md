# Archiver Library

This folder contains pure archiver logic that can be imported and used in any Node.js environment (lambda, backend, etc.).

## Structure

```
lib/
├── archivers/
│   ├── instagram/
│   │   └── instagramService.mjs
│   ├── dailyprince/
│   │   └── dailyprinceService.mjs
│   └── newsletter/
│       └── newsletterService.mjs
└── package.json
```

## Usage

### From Lambda

```javascript
// From lambda/src/handlers/instagram.mjs
import { fetchInstagramPosts, downloadImagesInstagram } from "../../../lib/archivers/instagram/instagramService.mjs";
```

### From Backend

```javascript
// From backend/routes/jobs.js
import { fetchInstagramPosts, downloadImagesInstagram } from "../../lib/archivers/instagram/instagramService.mjs";
```

## Utilities

### Logger

**Location:** `lib/utils/logger.mjs`

**Exports:**
- `createLogger(options)` - Creates a new logger instance with custom configuration
- `getLogger(options)` - Gets or creates the default logger instance
- `createChildLogger(bindings, options)` - Creates a child logger with additional context
- `default` - Default logger instance

**Usage:**
```javascript
// Simple usage with pino
import logger from "../../../lib/utils/logger.mjs";
logger.info("This is an info message");
logger.error("This is an error message");
logger.warn("This is a warning");
logger.debug("Debug message");

// Child logger with context
const childLogger = logger.child({ jobId: '123' });
childLogger.info("Processing job"); // Will include jobId in logs

// Create custom logger
import { createLogger } from "../../../lib/utils/logger.mjs";
const customLogger = createLogger({ level: 'debug' });
```

**Note:** This uses [pino](https://getpino.io/) logger. Make sure pino is installed in your project.

## Services

### Instagram Service

**Location:** `lib/archivers/instagram/instagramService.mjs`

**Exports:**
- `fetchInstagramPosts({ after, apifyToken, instagramAccount, resultsLimit, logger })` - Fetches Instagram posts from Apify
- `downloadImagesInstagram({ imageUrls, post, downloadLocally, path, fontPath, formatTimestamp, beautifyTimestamp, sanitizeText })` - Creates PDF from images
- `downloadVideoInstagram({ videoUrl, videoPath, metadataPath, post, downloadLocally, fontPath, formatTimestamp, beautifyTimestamp, sanitizeText })` - Downloads video and creates metadata PDF

### Newsletter Service

**Location:** `lib/archivers/newsletter/newsletterService.mjs`

**Exports:**
- `fetchNewslettersInWindow({ start, end, pageSize, apiKey, server })` - Fetches newsletters from Mailchimp
- `captureNewsletter({ url, browser })` - Captures newsletter as PDF using Puppeteer
- `getNewsletterForDate({ date, endDate, browser, apiKey, server, logger })` - Gets newsletters for a date range
- `filterNewsletterText(raw)` - Filters and cleans newsletter text content

### DailyPrince Service

**Location:** `lib/archivers/dailyprince/dailyprinceService.mjs`

**Exports:**
- `captureArticle({ url, browser, header, footer, startingPage, title, content, logger })` - Captures article as PDF
- `mergePDFBuffers({ buffers, dir, dpi, quality, generateImages, writeToDisk })` - Merges multiple PDF buffers
- `pdfToJpegs({ pdfPath, outDir, dpi, quality })` - Converts PDF to JP2 images using ImageMagick

## Design Principles

1. **Pure Logic**: Services contain only business logic, no environment-specific code
2. **Dependency Injection**: Services accept dependencies (browser, logger, API keys, etc.) as parameters
3. **Reusable**: Can be imported and used from any Node.js environment
4. **No Side Effects**: Services don't directly access environment variables or file system (except when explicitly passed)

## Notes

- All services use ES modules (`.mjs` extension)
- Services accept optional logger functions (defaults to `console`)
- File system operations are optional and controlled by `downloadLocally` or `writeToDisk` flags
- API keys and tokens should be passed as parameters, not accessed from `process.env` directly

