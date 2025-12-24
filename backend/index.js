import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { jobsRouter } from "./routes/jobs.js";
import "./db.js";

const app = express();

// Middleware
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per IP
    })
);
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
});

// API routes
app.use("/jobs", jobsRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("Error:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";
    res.status(status).json({
        error: message,
        ...(config.nodeEnv === "development" && { details: err.stack }),
    });
});

const PORT = config.port;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});

