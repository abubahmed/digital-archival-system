import { db } from "../db.js";

/**
 * Create a new job
 */
export function createJob(job) {
    const { id, createdAt, config, state = "running", statusText = "Running...", downloadUrl } = job;

    db.prepare(
        `
    INSERT INTO jobs (id, createdAt, source, archivalType, state, statusText, downloadUrl, config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
    ).run(id, createdAt, config.source, config.archivalType, state, statusText, downloadUrl || null, JSON.stringify(config));

    return { id, createdAt, config, state, statusText, downloadUrl };
}

/**
 * Get all jobs (basic info, no logs)
 */
export function getAllJobs() {
    const jobs = db
        .prepare(
            `
    SELECT id, createdAt, source, archivalType, state, statusText, downloadUrl
    FROM jobs
    ORDER BY createdAt DESC
  `
        )
        .all();

    return jobs.map((job) => ({
        id: job.id,
        createdAt: job.createdAt,
        config: {
            source: job.source,
            archivalType: job.archivalType,
        },
        state: job.state,
        statusText: job.statusText,
        downloadUrl: job.downloadUrl || undefined,
    }));
}

/**
 * Get job by ID (with logs)
 */
export function getJobById(jobId) {
    const job = db
        .prepare(
            `
    SELECT id, createdAt, source, archivalType, state, statusText, downloadUrl
    FROM jobs
    WHERE id = ?
  `
        )
        .get(jobId);

    if (!job) return null;

    const logs = db
        .prepare(
            `
    SELECT timestamp, level, message
    FROM logs
    WHERE jobId = ?
    ORDER BY timestamp ASC
  `
        )
        .all(jobId);

    return {
        id: job.id,
        createdAt: job.createdAt,
        config: {
            source: job.source,
            archivalType: job.archivalType,
        },
        state: job.state,
        statusText: job.statusText,
        downloadUrl: job.downloadUrl || undefined,
        logs: logs.map((log) => ({
            ts: log.timestamp,
            level: log.level,
            msg: log.message,
        })),
    };
}

/**
 * Update job state
 */
export function updateJob(jobId, updates) {
    const { state, statusText, downloadUrl } = updates;

    const setParts = [];
    const values = [];

    if (state !== undefined) {
        setParts.push("state = ?");
        values.push(state);
    }
    if (statusText !== undefined) {
        setParts.push("statusText = ?");
        values.push(statusText);
    }
    if (downloadUrl !== undefined) {
        setParts.push("downloadUrl = ?");
        values.push(downloadUrl || null);
    }

    if (setParts.length === 0) return;

    values.push(jobId);

    db.prepare(`UPDATE jobs SET ${setParts.join(", ")} WHERE id = ?`).run(...values);
}

