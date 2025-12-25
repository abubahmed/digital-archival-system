/**
 * Helper functions for jobs.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file jobHelpers.js
 */

/**
 * Generates a random string of a given length.
 * 
 * @param {number} length - The length of the string to generate.
 * 
 * @returns {string} The generated random string.
 */
export function generateRandomString(length) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Formats a timestamp to a string.
 * 
 * @param {number} timestamp - The timestamp to format.
 * 
 * @returns {string} The formatted timestamp.
 */
export function formatTimestamp(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

/**
 * Generates a job ID.
 * 
 * @param {string} source - The source of the job.
 * @param {string} archivalType - The archival type of the job.
 * @param {number} timestamp - The timestamp of the job.
 * 
 * @returns {string} The generated job ID.
 */
export function generateJobId(source, archivalType, timestamp = Date.now()) {
    const timestampStr = formatTimestamp(timestamp);
    const randomStr = generateRandomString(32);
    return `${source}-${archivalType}-${timestampStr}-${randomStr}`;
}