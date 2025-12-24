import express from "express";

const router = express.Router();

// GET /jobs - List all jobs
router.get("/", (req, res) => {
    // TODO: Implement job listing
    res.json({ jobs: [] });
});

// POST /jobs - Create/start a new archival job
router.post("/", (req, res) => {
    // TODO: Implement job creation
    res.status(201).json({ jobId: "placeholder-job-id" });
});

// GET /jobs/:jobId - Get specific job details
router.get("/:jobId", (req, res) => {
    // TODO: Implement job details retrieval
    res.status(404).json({ error: "Job not found" });
});

export { router as jobsRouter };

