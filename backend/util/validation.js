export function isValidYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseEstDatetimeInput(datetimeStr) {
    return new Date(datetimeStr + ":00-05:00");
}

function validateSingleDayParams(singleDayParams) {
    const { date, dateStartTime, dateEndTime } = singleDayParams;
    if (!isValidYmd(date)) {
        return "Single-day selected, but date is invalid.";
    }
    return null;
}

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

function validateUrlsParams(urlsParams) {
    const { urls } = urlsParams;
    if (urls.length === 0) {
        return "URL list selected, but no URLs were provided.";
    }
    return null;
}

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

export function validateBeforeRun(
    archivalType,
    authToken,
    singleDayParams,
    dateRangeParams,
    urlsParams,
    mostRecentParams
) {
    if (!archivalType) return "Archival type is required.";
    if (!authToken) return "API Key is required.";

    switch (archivalType) {
        case "singleDay":
            return validateSingleDayParams(singleDayParams);
        case "dateRange":
            return validateDateRangeParams(dateRangeParams);
        case "urls":
            return validateUrlsParams(urlsParams);
        case "mostRecent": {
            return validateMostRecentParams(mostRecentParams);
        }
    }
}