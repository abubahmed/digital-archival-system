import Database from "better-sqlite3";

const instagramPath = "./databases/instagram_times.db";

export const getTimes = () => {
  const db = new Database(instagramPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL
    )
  `);
  const rows = db.prepare("SELECT * FROM times").all();
  const times = rows.map((row) => row.time).filter(Boolean);
  db.close();
  return times;
};

export const addTime = () => {
  const db = new Database(instagramPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL
    )
  `);
  const time = new Date().toISOString();
  const addNewTime = db.prepare("INSERT INTO times (time) VALUES (?)");
  addNewTime.run(time);
  db.close();
  return time;
};

export const getLatestTime = () => {
  const db = new Database(instagramPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      time TEXT NOT NULL
    )
  `);
  const row = db.prepare("SELECT * FROM times ORDER BY time DESC LIMIT 1").get();
  const time = row?.time || new Date(0).toISOString();
  db.close();
  return time;
};
