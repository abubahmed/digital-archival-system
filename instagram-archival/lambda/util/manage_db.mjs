import Database from "better-sqlite3";
import log from "./logger.mjs";

/**
 * Retrieves all stored time entries from the database.
 *
 * @returns {Object} An object containing the fetch status, message, and an array of times.
 *
 * The function:
 * - Opens a SQLite database (`times.db`).
 * - Queries all records from the `times` table.
 * - Extracts and returns the time values.
 *
 * @example
 * getTimes();
 * // Returns: { status: "success", message: "All times retrieved", times: [...] }
 */
export const getTimes = () => {
  let db;
  try {
    db = new Database("./db/times.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL
    )
    `);
    const rows = db.prepare("SELECT * FROM times").all();
    const times = rows.map((row) => (row ? row.time : null)).filter((time) => time !== null);
    return {
      status: "success",
      message: "All times retrieved",
      times: times,
    };
  } catch (error) {
    log.error(error.message);
    return {
      status: "error",
      message: error.message,
      times: [],
    };
  } finally {
    if (db) db.close();
  }
};

/**
 * Adds the current timestamp to the database.
 *
 * @returns {Object} An object containing the operation status, message, and the saved time.
 *
 * The function:
 * - Opens a SQLite database (`times.db`).
 * - Generates the current timestamp in ISO format.
 * - Inserts the timestamp into the database.
 * - Returns the saved time upon success.
 *
 * @example
 * addTime();
 * // Returns: { status: "success", message: "Archival time saved", time: "2025-02-03T12:34:56.789Z" }
 */
export const addTime = () => {
  let db;
  try {
    db = new Database("./db/times.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL
    )
  `);
    const time = new Date().toISOString();
    const addNewTime = db.prepare("INSERT INTO times (time) VALUES (?)");
    addNewTime.run(time);
    return {
      status: "success",
      message: `Archival time saved`,
      time: time,
    };
  } catch (error) {
    log.error(error.message);
    return {
      status: "error",
      message: error.message,
      time: null,
    };
  } finally {
    if (db) db.close();
  }
};

/**
 * Retrieves the most recent timestamp from the database.
 *
 * @returns {Object} An object containing the operation status, message, and the latest recorded time.
 *
 * The function:
 * - Opens a SQLite database (`times.db`).
 * - Queries the latest timestamp entry, ordered by time in descending order.
 * - Returns the retrieved time or defaults to the Unix epoch time (`1970-01-01T00:00:00.000Z`) if no entry exists.
 *
 * @example
 * getLatestTime();
 * // Returns: { status: "success", message: "Latest time entry retrieved", time: "2025-02-03T14:30:00.123Z" }
 */
export const getLatestTime = () => {
  let db;
  try {
    db = new Database("./db/times.db");
    db.exec(`
      CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        time TEXT NOT NULL
      )
    `);
    const row = db.prepare("SELECT * FROM times ORDER BY time DESC LIMIT 1").get();
    let time = row ? row.time : null;
    if (!time) {
      time = new Date(0).toISOString();
    }
    return {
      status: "success",
      message: "Latest time entry retrieved",
      time: time,
    };
  } catch (error) {
    log.error(error.message);
    return {
      status: "error",
      message: error.message,
      time: null,
    };
  } finally {
    if (db) db.close();
  }
};
