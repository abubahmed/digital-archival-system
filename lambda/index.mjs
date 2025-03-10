import dotenv from "dotenv";
import { instagramHandler } from "./handlers/instagram.mjs";
dotenv.config();

export const handler = async (event, context, callback) => {
  console.log(event)
  console.log(context)

  if (process.env.ARCHIVE_TYPE === "INSTAGRAM") await instagramHandler();

  return {
    statusCode: 200,
  };
};
