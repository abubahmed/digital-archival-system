/**
 * Fake data for the archival system.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file data.js
 */

import { generateJobId } from "./utils/jobHelpers.js";

const firstJobId = generateJobId("dailyPrince", "singleDay", Date.now() - 2 * 24 * 60 * 60 * 1000)
const secondJobId = generateJobId("newsletter", "dateRange", Date.now() - 5 * 24 * 60 * 60 * 1000)
const thirdJobId = generateJobId("dailyPrinceIssues", "singleDay", Date.now() - 7 * 24 * 60 * 60 * 1000)

/**
 * Gets the fake jobs.
 * 
 * @returns {Object} The fake jobs.
 */
export function getFakeJobs() {
    const now = Date.now();
    return {
        [firstJobId]: {
            jobId: firstJobId,
            createdAt: now - 2 * 24 * 60 * 60 * 1000,
            source: "dailyPrince",
            archivalType: "singleDay",
            downloadUrl: "https://google.com",
            state: "running",
            logs: [
                { timestamp: now - 2 * 24 * 60 * 60 * 1000, level: "info", message: "Archive job configured." },
                {
                    timestamp: now - 2 * 24 * 60 * 60 * 1000 + 100,
                    level: "info",
                    message: "Source: dailyPrince, Type: singleDay",
                },
                { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 200, level: "info", message: "Starting archive process..." },
                { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 500, level: "info", message: "Fetching items..." },
                { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 800, level: "info", message: "Processing items..." },
                { timestamp: now - 2 * 24 * 60 * 60 * 1000 + 1100, level: "info", message: "Archive process complete." },
            ],
        },
        [secondJobId]: {
            jobId: secondJobId,
            createdAt: now - 5 * 24 * 60 * 60 * 1000,
            source: "newsletter",
            archivalType: "dateRange",
            downloadUrl: "https://google.com",
            state: "success",
            logs: [
                { timestamp: now - 5 * 24 * 60 * 60 * 1000, level: "info", message: "Archive job configured." },
                {
                    timestamp: now - 5 * 24 * 60 * 60 * 1000 + 100,
                    level: "info",
                    message: "Source: newsletter, Type: dateRange",
                },
                { timestamp: now - 5 * 24 * 60 * 60 * 1000 + 200, level: "info", message: "Starting archive process..." },
                { timestamp: now - 5 * 24 * 60 * 60 * 1000 + 500, level: "debug", message: "Validating inputs..." },
                { timestamp: now - 5 * 24 * 60 * 60 * 1000 + 750, level: "info", message: "Fetching newsletters..." },
                { timestamp: now - 5 * 24 * 60 * 60 * 1000 + 1050, level: "info", message: "Processing items..." },
                { timestamp: now - 5 * 24 * 60 * 60 * 1000 + 1350, level: "info", message: "Archive process complete." },
            ],
        },
        [thirdJobId]: {
            jobId: thirdJobId,
            createdAt: now - 7 * 24 * 60 * 60 * 1000,
            source: "dailyPrinceIssues",
            archivalType: "singleDay",
            downloadUrl: "https://google.com",
            state: "success",
            logs: [
                { timestamp: now - 7 * 24 * 60 * 60 * 1000, level: "info", message: "Archive job configured." },
                {
                    timestamp: now - 7 * 24 * 60 * 60 * 1000 + 100,
                    level: "info",
                    message: "Source: dailyPrinceIssues, Type: singleDay",
                },
                { timestamp: now - 7 * 24 * 60 * 60 * 1000 + 200, level: "info", message: "Starting archive process..." },
                { timestamp: now - 7 * 24 * 60 * 60 * 1000 + 500, level: "info", message: "Archive process complete." },
            ],
        },
    };
}
