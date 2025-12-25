/**
 * Database operations for managing jobs table.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file jobs.js
 */

import { db } from "../db.js";

/**
 * Creates a new job in the jobs table.
 * 
 * @param {Object} job - The job object to create.
 */
export function createJob(job) {
    const { jobId, createdAt, state, downloadUrl, source, archivalType } = job;

    db.prepare(
        `
            INSERT INTO jobs (jobId, createdAt, state, downloadUrl, source, archivalType)
            VALUES (?, ?, ?, ?, ?, ?)
        `
    ).run(jobId, createdAt, state, downloadUrl || null, source, archivalType);
}

/**
 * Gets all jobs from the jobs table.
 * 
 * @returns {Object} The list of jobs.
 */
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

    // Prepare the statement to get the logs for a job.
    const getLogsStmt = db.prepare(
        `
            SELECT message, timestamp, level
            FROM logs
            WHERE jobId = ?
            ORDER BY timestamp ASC
        `
    );

    // Convert the jobs to a dictionary of job objects.
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

/**
 * Gets a job by its ID from the jobs table.
 * 
 * @param {string} jobId - The ID of the job to get.
 * 
 * @returns {Object} The job object.
 */
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

    // Prepare the statement to get the logs for a job.
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

    // Convert the job to a job object.
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
