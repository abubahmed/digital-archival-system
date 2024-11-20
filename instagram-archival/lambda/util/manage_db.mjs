import Database from "better-sqlite3";
import log from "npmlog";

export const readArchivedPosts = () => {
  const db = new Database("./../database.db");
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
    `);
    log.info("Posts table created");
  } catch (err) {
    log.error("Error creating table:", err.message);
  }
  try {
    const rows = db.prepare("SELECT * FROM posts").all();
    log.info("Rows retrieved:", rows);
    db.close();
    return {
      status: "success",
      rows,
    };
  } catch (err) {
    log.error("Error retrieving rows:", err.message);
    db.close();
    return {
      status: "error",
      message: err.message,
    };
  }
};

export const saveArchivedPost = ({ url, created_timestamp, post_id }) => {
  if (!url || !created_timestamp || !post_id) {
    log.error("Missing required parameters");
    return;
  }
  const db = new Database("./database.db");
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
  `);
    log.info("Posts table created");
  } catch (err) {
    log.error("Error creating table:", err.message);
  }
  try {
    const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
    if (existingPost) {
      log.error("Post with the same post_id already exists");
      db.close();
      return;
    }
    const newPost = db.prepare(
      "INSERT INTO posts (url, created_timestamp, archived_timestamp, post_id) VALUES (?, ?, ?, ?)"
    );
    const archived_timestamp = new Date().toISOString();
    newPost.run(url, created_timestamp, archived_timestamp, post_id);
    log.info("Post with post_id:", post_id, "inserted");
    db.close();
    return {
      status: "success",
    };
  } catch (error) {
    log.error("Error inserting row:", error.message);
    db.close();
    return {
      status: "error",
      message: error.message,
    };
  }
};

export const deleteArchivedPost = ({ post_id }) => {
  if (!post_id) {
    log.error("Missing required parameters");
    return;
  }
  const db = new Database("./database.db");
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
  `);
    log.info("Posts table created");
  } catch (err) {
    log.error("Error creating table:", err.message);
  }
  try {
    const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
    if (!existingPost) {
      log.error("Post with the same post_id does not exist");
      db.close();
      return;
    }
    const deletePost = db.prepare("DELETE FROM posts WHERE post_id = ?");
    deletePost.run(post_id);
    log.info("Post with post_id:", post_id, "deleted");
    db.close();
    return {
      status: "success",
    };
  } catch (error) {
    log.error("Error deleting row:", error.message);
    db.close();
    return {
      status: "error",
      message: error.message,
    };
  }
};
