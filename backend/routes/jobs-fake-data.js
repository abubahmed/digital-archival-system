import express from "express";
import { getFakeJobs } from "../data.js";

const router = express.Router();

// GET /jobs - List all jobs
router.get("/", (req, res) => {
    try {
        const jobs = getFakeJobs();
        res.status(200).json({ jobs: jobs, error: null });
    } catch (error) {
        res.status(500).json({ jobs: {}, error: error.message });
    }
});

// POST /jobs - Create/start a new archival job
router.post("/", (req, res) => {
    try {
        console.log("req.body", req.body);
        const randomFakeJobId = Object.keys(getFakeJobs())[Math.floor(Math.random() * Object.keys(getFakeJobs()).length)];
        const fakeJob = getFakeJobs()[randomFakeJobId];

        res.status(201).json({ job: fakeJob, error: null });
    } catch (error) {
        res.status(500).json({ job: null, error: error.message });
    }
});

// GET /jobs/:jobId - Get specific job details
router.get("/:jobId", (req, res) => {
    try {
        const { jobId } = req.params;
        const job = getFakeJobs()[jobId];
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        console.log("Pinging for job:", jobId);
        res.status(200).json({ job: job, error: null });
    } catch (error) {
        res.status(500).json({ job: null, error: error.message });
    }
});

// GET /jobs/:jobId/stream - Server-Sent Events stream for job updates
router.get("/:jobId/stream", (req, res) => {
    const { jobId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
    res.write(": connected\n\n");

    const fakeJobs = getFakeJobs();
    const job = fakeJobs[jobId];
    if (!job) {
        res.write(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`);
        res.end();
        return;
    }

    res.write(`data: ${JSON.stringify({ job })}\n\n`);
    const DELAY_BETWEEN_UPDATES = 1000;
    if (job.state !== "running") {
        res.end();
        return;
    }

    const intervalId = setInterval(() => {
        const currentJob = getFakeJobs()[jobId];
        if (!currentJob) {
            clearInterval(intervalId);
            res.end();
            return;
        }

        console.log("Writing job update at", new Date().toISOString());
        currentJob.logs.push({
            timestamp: Date.now(),
            message: "Created debug log at " + new Date().toISOString(),
            level: "info",
        });

        res.write(`data: ${JSON.stringify({ job: currentJob })}\n\n`);
        if (currentJob.state !== "running") {
            clearInterval(intervalId);
            res.end();
        }
    }, DELAY_BETWEEN_UPDATES);

    req.on("close", () => {
        clearInterval(intervalId);
        res.end();
    });
});

export { router as jobsRouter };

