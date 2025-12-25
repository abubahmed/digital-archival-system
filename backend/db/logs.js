/**
 * Database operations for managing logs table.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file logs.js
 */

import { db } from "../db.js";

/**
 * Adds a new log to the logs table.
 * 
 * @param {string} jobId - The ID of the job.
 * @param {Object} log - The log object to add.
 */
export function addLog(jobId, log) {
    const { message, timestamp, level } = log;

    db.prepare(
        `
            INSERT INTO logs (jobId, message, timestamp, level)
            VALUES (?, ?, ?, ?)
        `
    ).run(jobId, message, timestamp, level);
}

/**
 * Gets the logs for a job from the logs table.
 * 
 * @param {string} jobId - The ID of the job.
 * @param {Object} options - The options for the query.
 * @param {number} options.limit - The limit of the query.
 * @param {number} options.offset - The offset of the query.
 * 
 * @returns {Object} The list of logs.
 */
export function getLogs(jobId, options = {}) {
    const { limit, offset = 0 } = options;

    let query = `
            SELECT message, timestamp, level
            FROM logs
            WHERE jobId = ?
            ORDER BY timestamp ASC
        `;
    const params = [jobId];

    if (limit) {
        query += " LIMIT ? OFFSET ?";
        params.push(limit, offset);
    }
    const logs = db.prepare(query).all(...params);

    return logs.map((log) => ({
        message: log.message,
        timestamp: log.timestamp,
        level: log.level,
    }));
}

/**
 * Gets the recent logs for a job from the logs table.
 * 
 * @param {string} jobId - The ID of the job.
 * @param {number} limit - The limit of the query.
 * 
 * @returns {Object} The list of logs.
 */
export function getRecentLogs(jobId, limit = 100) {
    const logs = db
        .prepare(
            `
                SELECT message, timestamp, level
                FROM logs
                WHERE jobId = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `
        )
        .all(jobId, limit);

    return logs
        .reverse()
        .map((log) => ({
            message: log.message,
            timestamp: log.timestamp,
            level: log.level,
        }));
}

/**
 * Gets the count of logs for a job from the logs table.
 * 
 * @param {string} jobId - The ID of the job.
 * 
 * @returns {number} The count of logs.
 */
export function getLogCount(jobId) {
    const result = db
        .prepare(
            `
                SELECT COUNT(*) as count
                FROM logs
                WHERE jobId = ?
            `
        )
        .get(jobId);
    return result.count;
}

