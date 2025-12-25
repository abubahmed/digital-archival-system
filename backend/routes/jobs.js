import express from "express";
import { getAllJobs, createJob, getJobById } from "../db/jobs.js";

const router = express.Router();

// GET /jobs - List all jobs
router.get("/", (req, res) => {
    try {
        
        res.status(200).json({ jobs: jobs, error: null });
    } catch (error) {
        res.status(500).json({ jobs: {}, error: error.message });
    }
});

// POST /jobs - Create/start a new archival job
router.post("/", (req, res) => {
    try {
        const { config } = req.body;
        const { source, archivalType, singleDayParams, dateRangeParams, urlsParams, mostRecentParams, createdAt, authToken } = config;

        const validationErrors = validateBeforeRun(archivalType, authToken, singleDayParams, dateRangeParams, urlsParams, mostRecentParams);
        if (validationErrors) {
            return res.status(400).json({ error: validationErrors });
        }

        const jobId = generateJobId(source, archivalType, createdAt);
        const createdJob = {
            id: jobId,
            state: "running",
            downloadUrl: null,
            logs: [],
            createdAt,
            source,
            archivalType,
        }

        res.status(201).json({ job: createdJob, error: null });
    } catch (error) {
        res.status(500).json({ job: null, error: error.message });
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

