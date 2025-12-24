import { db } from "../db.js";

/**
 * Add a log entry to a job
 */
export function addLog(jobId, log) {
    const { ts, level, msg } = log;

    db.prepare(
        `
            INSERT INTO logs (jobId, timestamp, level, message)
            VALUES (?, ?, ?, ?)
        `
    ).run(jobId, ts, level, msg);
}

/**
 * Get logs for a job (with pagination)
 */
export function getLogs(jobId, options = {}) {
    const { limit, offset = 0 } = options;

    let query = `
            SELECT timestamp, level, message
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
        ts: log.timestamp,
        level: log.level,
        msg: log.message,
    }));
}

/**
 * Get recent logs for a job (last N logs)
 */
export function getRecentLogs(jobId, limit = 100) {
    const logs = db
        .prepare(
            `
                SELECT timestamp, level, message
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
            ts: log.timestamp,
            level: log.level,
            msg: log.message,
        }));
}

/**
 * Get log count for a job
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

