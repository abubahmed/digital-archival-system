/**
 * Formats a timestamp to a YYYY-MM-DD string
 * @param {Date|string} timestamp - The timestamp to format
 * @returns {string} The formatted timestamp
 */
export const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/**
 * Subtracts a number of days from a date
 * @param {Date|string} date - The date to subtract from
 * @param {number} days - The number of days to subtract
 * @returns {Date} The new date
 */
export const subtractDays = (date, days) => {
    const newDate = new Date(date);
    newDate.setTime(newDate.getTime() - days * 24 * 60 * 60 * 1000);
    return newDate;
};
