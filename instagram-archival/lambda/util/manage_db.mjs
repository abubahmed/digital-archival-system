// import Database from "better-sqlite3";
// import log from "./logger.mjs"

// export const readArchivedPost = ({ post_id }) => {
//   if (!post_id) {
//     log.error("Missing required argument(s)");
//     return {
//       status: "error",
//       message: "Missing required argument(s)",
//       row: null,
//     };
//   }
//   try {
//     const db = new Database("./db/posts.db");
//     db.exec(`
//     CREATE TABLE IF NOT EXISTS posts (
//       id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
//       url TEXT NOT NULL,
//       created_timestamp TEXT NOT NULL,
//       archived_timestamp TEXT NOT NULL,
//       post_id TEXT NOT NULL
//     )
//     `);
//     const row = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
//     if (!row) {
//       db.close();
//       return {
//         status: "success",
//         message: `Row with post_id ${post_id} not found`,
//         row: null,
//       };
//     }
//     db.close();
//     return {
//       status: "success",
//       message: `Row with post_id ${post_id} retrieved`,
//       row,
//     };
//   } catch (error) {
//     log.error(error.message);
//     db.close();
//     return {
//       status: "error",
//       message: error.message,
//       row: null,
//     };
//   }
// };

// export const readArchivedPosts = () => {
//   try {
//     const db = new Database("./db/posts.db");
//     db.exec(`
//     CREATE TABLE IF NOT EXISTS posts (
//       id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
//       url TEXT NOT NULL,
//       created_timestamp TEXT NOT NULL,
//       archived_timestamp TEXT NOT NULL,
//       post_id TEXT NOT NULL
//     )
//     `);
//     const rows = db.prepare("SELECT * FROM posts").all();
//     if (!rows) {
//       db.close();
//       return {
//         status: "success",
//         message: "No rows found",
//         rows: [],
//       };
//     }
//     db.close();
//     return {
//       status: "success",
//       message: "All rows retrieved",
//       rows,
//     };
//   } catch (error) {
//     log.error(error.message);
//     db.close();
//     return {
//       status: "error",
//       message: error.message,
//       rows: [],
//     };
//   }
// };

// export const saveArchivedPost = ({ url, created_timestamp, post_id }) => {
//   if (!url || !created_timestamp || !post_id) {
//     log.error("Missing required argument(s)");
//     return {
//       status: "error",
//       message: "Missing required argument(s)",
//     };
//   }
//   try {
//     const db = new Database("./db/posts.db");
//     db.exec(`
//     CREATE TABLE IF NOT EXISTS posts (
//       id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
//       url TEXT NOT NULL,
//       created_timestamp TEXT NOT NULL,
//       archived_timestamp TEXT NOT NULL,
//       post_id TEXT NOT NULL
//     )
//   `);
//     const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
//     if (existingPost) {
//       log.error(`Post with post_id ${post_id} already exists`);
//       db.close();
//       return {
//         status: "error",
//         message: `Post with post_id ${post_id} already exists`,
//       };
//     }
//     const newPost = db.prepare(
//       "INSERT INTO posts (url, created_timestamp, archived_timestamp, post_id) VALUES (?, ?, ?, ?)"
//     );
//     const archived_timestamp = new Date().toISOString();
//     newPost.run(url, created_timestamp, archived_timestamp, post_id);
//     db.close();
//     return {
//       status: "success",
//       message: `Post with post_id ${post_id} saved`,
//     };
//   } catch (error) {
//     log.error(error.message);
//     db.close();
//     return {
//       status: "error",
//       message: error.message,
//     };
//   }
// };

// export const deleteArchivedPost = ({ post_id }) => {
//   if (!post_id) {
//     log.error("Missing required argument(s)");
//     return {
//       status: "error",
//       message: "Missing required argument(s)",
//     };
//   }
//   try {
//     const db = new Database("./db/posts.db");
//     db.exec(`
//     CREATE TABLE IF NOT EXISTS posts (
//       id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
//       url TEXT NOT NULL,
//       created_timestamp TEXT NOT NULL,
//       archived_timestamp TEXT NOT NULL,
//       post_id TEXT NOT NULL
//     )
//   `);
//     const existingPost = db.prepare("SELECT * FROM posts WHERE post_id = ?").get(post_id);
//     if (!existingPost) {
//       log.error(`Post with post_id ${post_id} does not exist`);
//       db.close();
//       return {
//         status: "error",
//         message: `Post with post_id ${post_id} does not exist`,
//       };
//     }
//     const deletePost = db.prepare("DELETE FROM posts WHERE post_id = ?");
//     deletePost.run(post_id);
//     db.close();
//     return {
//       status: "success",
//       message: `Post with post_id ${post_id} deleted`,
//     };
//   } catch (error) {
//     log.error(error.message);
//     db.close();
//     return {
//       status: "error",
//       message: error.message,
//     };
//   }
// };
