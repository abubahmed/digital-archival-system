/**
 * Validation functions for the archival system.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file validation.js
 */

/**
 * Checks if a string is a valid YMD date.
 * 
 * @param {string} s - The string to check.
 * 
 * @returns {boolean} True if the string is a valid YMD date, false otherwise.
 */
export function isValidYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Parses an EST datetime string to a Date object.
 * 
 * @param {string} datetimeStr - The datetime string to parse.
 * 
 * @returns {Date} The parsed Date object.
 */
export function parseEstDatetimeInput(datetimeStr) {
    return new Date(datetimeStr + ":00-05:00");
}

/**
 * Validates the single-day parameters.
 * 
 * @param {Object} singleDayParams - The single-day parameters.
 * @param {string} singleDayParams.date - The date.
 * @param {string} singleDayParams.dateStartTime - The start time of the date.
 * @param {string} singleDayParams.dateEndTime - The end time of the date.
 * 
 * @returns {string | null} The error message if the parameters are invalid, null otherwise.
 */
function validateSingleDayParams(singleDayParams) {
    const { date, dateStartTime, dateEndTime } = singleDayParams;
    if (!isValidYmd(date)) {
        return "Single-day selected, but date is invalid.";
    }
    return null;
}

/**
 * Validates the date-range parameters.
 * 
 * @param {Object} dateRangeParams - The date-range parameters.
 * @param {string} dateRangeParams.start - The start date.
 * @param {string} dateRangeParams.end - The end date.
 * @param {string} dateRangeParams.startTime - The start time of the date range.
 * @param {string} dateRangeParams.endTime - The end time of the date range.
 * 
 * @returns {string | null} The error message if the parameters are invalid, null otherwise.
 */
function validateDateRangeParams(dateRangeParams) {
    const { start, end, startTime, endTime } = dateRangeParams;
    if (!isValidYmd(start) || !isValidYmd(end)) {
        return "Date-range selected, but start/end are invalid.";
    }
    if (start > end) {
        return "Date-range selected, but start date is after end date.";
    }
    return null;
}

/**
 * Validates the URLs parameters.
 * 
 * @param {Object} urlsParams - The URLs parameters.
 * @param {string[]} urlsParams.urls - The URLs to validate.
 * 
 * @returns {string | null} The error message if the parameters are invalid, null otherwise.
 */
function validateUrlsParams(urlsParams) {
    const { urls } = urlsParams;
    if (urls.length === 0) {
        return "URL list selected, but no URLs were provided.";
    }
    return null;
}

/**
 * Validates the most-recent parameters.
 * 
 * @param {Object} mostRecentParams - The most-recent parameters.
 * @param {string} mostRecentParams.mostRecentSince - The starting date/time.
 * @param {number} mostRecentParams.mostRecentCount - The number of items to retrieve.
 * 
 * @returns {string | null} The error message if the parameters are invalid, null otherwise.
 */
function validateMostRecentParams(mostRecentParams) {
    const { mostRecentSince, mostRecentCount } = mostRecentParams;
    if (!mostRecentSince) {
        return "Most-recent selected, but the starting date/time is invalid.";
    }
    try {
        const since = parseEstDatetimeInput(mostRecentSince);
        if (Number.isNaN(since.getTime())) {
            return "Most-recent selected, but the starting date/time is invalid.";
        }
    } catch {
        return "Most-recent selected, but the starting date/time is invalid.";
    }
    if (!Number.isFinite(mostRecentCount) || mostRecentCount <= 0) {
        return "Most-recent selected, but item count must be a positive number.";
    }
    return null;
}

/**
 * Validates the parameters before running the archival.
 * 
 * @param {Object} params - The parameters to validate.
 * @param {string} params.archivalType - The archival type.
 * @param {string} params.authToken - The API key.
 * @param {Object} params.typeParams - The type parameters.
 * 
 * @returns {string | null} The error message if the parameters are invalid, null otherwise.
 */
export function validateBeforeRun({
    archivalType,
    authToken,
    typeParams,
}) {
    if (!archivalType) return "Archival type is required.";
    if (!authToken) return "API Key is required.";

    if (archivalType === "singleDay") {
        return validateSingleDayParams(typeParams);
    } else if (archivalType === "dateRange") {
        return validateDateRangeParams(typeParams);
    } else if (archivalType === "urls") {
        return validateUrlsParams(typeParams);
    } else if (archivalType === "mostRecent") {
        return validateMostRecentParams(typeParams);
    }
    return null;
}