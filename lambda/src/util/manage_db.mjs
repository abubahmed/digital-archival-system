import Database from "better-sqlite3";

class TimeDatabase {
    static dbDir = "./databases";
    static dbPaths = {
        instagram: `${this.dbDir}/instagram.db`,
        dailyprince: `${this.dbDir}/dailyprince.db`,
        newsletter: `${this.dbDir}/newsletter.db`,
    };

    constructor(archiveType) {
        if (!(archiveType in TimeDatabase.dbPaths)) {
            throw new Error(`Invalid archive type: ${archiveType}`);
        }
        this.archiveType = archiveType;
        this.dbPath = TimeDatabase.dbPaths[archiveType];
        this.ensureTable();
    }

    ensureTable() {
        const db = new Database(this.dbPath);
        db.exec(`
      CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        time TEXT NOT NULL
      )
    `);
        db.close();
    }

    getTimes() {
        const db = new Database(this.dbPath);
        const rows = db.prepare("SELECT * FROM times").all();
        db.close();
        const times = rows.map(row => row.time).filter(Boolean);
        return times.length > 0 ? times : [new Date(0)];
    }

    addTime() {
        const db = new Database(this.dbPath);
        const time = new Date().toISOString();
        const insert = db.prepare("INSERT INTO times (time) VALUES (?)");
        insert.run(time);
        db.close();
    }

    getLatestTime() {
        const db = new Database(this.dbPath);
        const row = db.prepare("SELECT * FROM times ORDER BY time DESC LIMIT 1").get();
        db.close();
        return row?.time || new Date(0);
    }
}

export default TimeDatabase;