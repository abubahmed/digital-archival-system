import { db } from "../db.js";

export function createJob(job) {
    const { jobId, createdAt, state, downloadUrl, source, archivalType } = job;

    db.prepare(
        `
            INSERT INTO jobs (jobId, createdAt, state, downloadUrl, source, archivalType)
            VALUES (?, ?, ?, ?, ?, ?)
        `
    ).run(jobId, createdAt, state, downloadUrl || null, source, archivalType);

    return { jobId, createdAt, state, downloadUrl, source, archivalType };
}

export function getAllJobs() {
    const jobs = db
        .prepare(
            `
                SELECT jobId, createdAt, state, downloadUrl, source, archivalType
                FROM jobs
                ORDER BY createdAt DESC
            `
        )
        .all();

    const getLogsStmt = db.prepare(
        `
            SELECT message, timestamp, level
            FROM logs
            WHERE jobId = ?
            ORDER BY timestamp ASC
        `
    );

    return jobs.reduce((acc, job) => {
        const logs = getLogsStmt.all(job.jobId);
        acc[job.jobId] = {
            jobId: job.jobId,
            createdAt: job.createdAt,
            state: job.state,
            downloadUrl: job.downloadUrl || undefined,
            source: job.source,
            archivalType: job.archivalType,
            logs: logs.map((log) => ({
                message: log.message,
                timestamp: log.timestamp,
                level: log.level,
            })),
        };
        return acc;
    }, {});
}

export function getJobById(jobId) {
    const job = db
        .prepare(
            `
                SELECT jobId, createdAt, state, downloadUrl, source, archivalType
                FROM jobs
                WHERE jobId = ?
            `
        )
        .get(jobId);

    if (!job) return null;

    const logs = db
        .prepare(
            `
                SELECT message, timestamp, level
                FROM logs
                WHERE jobId = ?
                ORDER BY timestamp ASC
            `
        )
        .all(jobId);

    return {
        jobId: job.jobId,
        createdAt: job.createdAt,
        state: job.state,
        downloadUrl: job.downloadUrl || undefined,
        source: job.source,
        archivalType: job.archivalType,
        logs: logs.map((log) => ({
            message: log.message,
            timestamp: log.timestamp,
            level: log.level,
        })),
    };
}
