import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = path.join(__dirname, "database.db");

// Create/connect to database
export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize schema
export function initDatabase() {
    // Jobs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            createdAt INTEGER NOT NULL,
            source TEXT NOT NULL,
            archivalType TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'running',
            statusText TEXT NOT NULL DEFAULT 'Running...',
            downloadUrl TEXT,
            config TEXT NOT NULL
        )
    `);

    // Logs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jobId TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
        )
    `);

    // Create indexes for performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_logs_jobId_timestamp 
        ON logs(jobId, timestamp DESC)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_jobs_createdAt 
        ON jobs(createdAt DESC)
    `);
}

// Initialize on import
initDatabase();

