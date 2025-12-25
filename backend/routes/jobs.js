/**
 * Routes for jobs.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file jobs.js
 */

import express from "express";
import { getAllJobs, createJob, getJobById } from "../db/jobs.js";
import { generateJobId } from "../utils/jobHelpers.js";
import { validateBeforeRun } from "../utils/validation.js";

const router = express.Router();

/**
 * GET /jobs - List all jobs
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
router.get("/", (req, res) => {
    try {
        const jobs = getAllJobs();
        res.status(200).json({ jobs: jobs, error: null });
    } catch (error) {
        res.status(500).json({ jobs: {}, error: error.message });
    }
});

/**
 * POST /jobs - Create/start a new archival job
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
router.post("/", (req, res) => {
    try {
        console.log("req.body", req.body);
        const validationError = validateBeforeRun(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const { typeParams, authToken, source, archivalType } = req.body;
        const createdAt = Date.now();
        const jobId = generateJobId(source, archivalType, createdAt);

        const jobData = {
            jobId,
            createdAt,
            state: "running",
            downloadUrl: null,
            source,
            archivalType,
        };
        createJob(jobData);
        const job = getJobById(jobId);
        res.status(201).json({ job: job, error: null });
    } catch (error) {
        res.status(500).json({ job: null, error: error.message });
    }
});

/**
 * GET /jobs/:jobId - Get specific job details
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
router.get("/:jobId", (req, res) => {
    try {
        const { jobId } = req.params;
        const job = getJobById(jobId);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        console.log("Pinging for job:", jobId);
        res.status(200).json({ job: job, error: null });
    } catch (error) {
        res.status(500).json({ job: null, error: error.message });
    }
});

/**
 * GET /jobs/:jobId/stream - Server-Sent Events stream for job updates
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
router.get("/:jobId/stream", (req, res) => {
    const { jobId } = req.params;

    // Set the headers for the SSE stream.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
    res.write(": connected\n\n");

    // Get the job from the database.
    const job = getJobById(jobId);
    if (!job) {
        res.write(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`);
        res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
        res.end();
        return;
    }

    // Write the job to the SSE stream.
    res.write(`data: ${JSON.stringify({ job })}\n\n`);
    const DELAY_BETWEEN_UPDATES = 5000;
    if (job.state !== "running") {
        res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
        res.end();
        return;
    }

    // Set the interval to write the job updates to the SSE stream.
    const intervalId = setInterval(() => {
        const currentJob = getJobById(jobId);
        if (!currentJob) {
            clearInterval(intervalId);
            res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
            res.end();
            return;
        }

        // Add a new log to the current job.
        console.log("Writing to job with id", jobId, "at", new Date().toISOString());
        res.write(`data: ${JSON.stringify({ job: currentJob })}\n\n`);
        if (currentJob.state !== "running") {
            clearInterval(intervalId);
            res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
            res.end();
        }
    }, DELAY_BETWEEN_UPDATES);

    // On close, clear the interval and end the SSE stream.
    req.on("close", () => {
        clearInterval(intervalId);
        res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
        res.end();
    });
});

export { router as jobsRouter };

