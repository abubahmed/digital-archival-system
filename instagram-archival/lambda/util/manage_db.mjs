import Database from "better-sqlite3";
import log from "./logger.mjs"

export const readArchivedPost = ({ post_id }) => {
  if (!post_id) {
    log.error("Missing required parameters");
    return {
      status: "error",
      message: "Missing required parameters",
      row: null,
    };
  }
  try {
    const db = new Database("./db/posts.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
    `);
    const row = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
    if (!row) {
      log.info("No row found");
      db.close();
      return {
        status: "success",
        message: "Row not found",
        row: null,
      };
    }
    log.info("Row retrieved:");
    log.info(row);
    db.close();
    return {
      status: "success",
      message: "Row retrieved",
      row,
    };
  } catch (error) {
    log.error(error.message);
    db.close();
    return {
      status: "error",
      message: error.message,
      row: null,
    };
  }
};

export const readArchivedPosts = () => {
  try {
    const db = new Database("./db/posts.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
    `);
    const rows = db.prepare("SELECT * FROM posts").all();
    if (!rows) {
      log.info("No rows found");
      db.close();
      return {
        status: "success",
        message: "Rows not found",
        rows: [],
      };
    }
    log.info("Rows retrieved:", rows);
    db.close();
    return {
      status: "success",
      message: "Rows retrieved",
      rows,
    };
  } catch (error) {
    log.error(error.message);
    db.close();
    return {
      status: "error",
      message: error.message,
      rows: [],
    };
  }
};

export const saveArchivedPost = ({ url, created_timestamp, post_id }) => {
  if (!url || !created_timestamp || !post_id) {
    log.error("Missing required parameters");
    return {
      status: "error",
      message: "Missing required parameters",
    };
  }
  try {
    const db = new Database("./db/posts.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
  `);
    const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
    if (existingPost) {
      log.error("Post with the same post_id already exists");
      db.close();
      return {
        status: "error",
        message: "Post with the same post_id already exists",
      };
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
      message: "Post inserted",
    };
  } catch (error) {
    log.error(error.message);
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
    return {
      status: "error",
      message: "Missing required parameters",
    };
  }
  try {
    const db = new Database("./db/posts.db");
    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      created_timestamp TEXT NOT NULL,
      archived_timestamp TEXT NOT NULL,
      post_id TEXT NOT NULL
    )
  `);
    const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
    if (!existingPost) {
      log.error("Post with the same post_id does not exist");
      db.close();
      return {
        status: "error",
        message: "Post with the same post_id does not exist",
      };
    }
    const deletePost = db.prepare("DELETE FROM posts WHERE post_id = ?");
    deletePost.run(post_id);
    log.info("Post with post_id:", post_id, "deleted");
    db.close();
    return {
      status: "success",
      message: "Post deleted",
    };
  } catch (error) {
    log.error(error.message);
    db.close();
    return {
      status: "error",
      message: error.message,
    };
  }
};
