import Database from "better-sqlite3";
import log from "./logger.mjs";

export const getTimes = () => {
  let db;
  try {
    db = new Database("./db/times.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL,
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

export const addTime = () => {
  let db;
  try {
    db = new Database("./db/times.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL,
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
    const time = row ? row.time : null;
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
