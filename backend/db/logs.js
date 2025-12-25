import { db } from "../db.js";

export function addLog(jobId, log) {
    const { message, timestamp, level } = log;

    db.prepare(
        `
            INSERT INTO logs (jobId, message, timestamp, level)
            VALUES (?, ?, ?, ?)
        `
    ).run(jobId, message, timestamp, level);
}

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

