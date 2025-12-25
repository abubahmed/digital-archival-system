/**
 * Database for the archival system.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file db.js
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "database.db");

export const db = new Database(DB_PATH);

db.pragma("foreign_keys = ON");

/**
 * Initializes the database.
 */
export function initDatabase() {
    // Create jobs table if it doesn't exist.
    db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            jobId TEXT PRIMARY KEY,
            createdAt INTEGER NOT NULL,
            state TEXT NOT NULL,
            downloadUrl TEXT,
            source TEXT NOT NULL,
            archivalType TEXT NOT NULL
        )
    `);

    // Create logs table if it doesn't exist.
    db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jobId TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            level TEXT NOT NULL,
            FOREIGN KEY (jobId) REFERENCES jobs(jobId) ON DELETE CASCADE
        )
    `);

    // Create index on logs table if it doesn't exist.
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_logs_jobId_timestamp 
        ON logs(jobId, timestamp DESC)
    `);

    // Create index on jobs table if it doesn't exist.
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_jobs_createdAt 
        ON jobs(createdAt DESC)
    `);
}

initDatabase();

