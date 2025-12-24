import express from "express";
import { getAllJobs, createJob, getJobById } from "../db/jobs.js";

const router = express.Router();

// GET /jobs - List all jobs
router.get("/", (req, res) => {
    try {
        const jobs = getAllJobs();
        res.json({ jobs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /jobs - Create/start a new archival job
router.post("/", (req, res) => {
    try {
        const { source, archivalType } = req.body;

        if (!source || !archivalType) {
            return res.status(400).json({ error: "source and archivalType are required" });
        }

        // Generate job ID
        const id = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const createdAt = Date.now();

        const job = createJob({
            id,
            createdAt,
            config: req.body,
            state: "running",
            statusText: "Running...",
        });

        res.status(201).json({ jobId: job.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /jobs/:jobId - Get specific job details
router.get("/:jobId", (req, res) => {
    try {
        const { jobId } = req.params;
        const job = getJobById(jobId);

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export { router as jobsRouter };

