import { instagramHandler } from "./handlers/instagram.mjs";
import { dailyPrinceHandler } from "./handlers/dailyprince.mjs";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context, callback) => {
  console.log(event);
  console.log(context);

  const archiveType = process.env.ARCHIVE_TYPE;
  if (archiveType === "instagram") await instagramHandler({ event, context, callback });
  if (archiveType === "dailyprince") await dailyPrinceHandler({ event, context, callback });

  return {
    statusCode: 200,
  };
};
