import { instagramHandler } from "./handlers/instagram.mjs";
import { dailyPrinceHandler } from "./handlers/dailyprince.mjs";
import { newsLetterHandler } from "./handlers/newsletter.mjs";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context, callback) => {
  console.log(event);
  console.log(context);

  const archiveType = process.env.ARCHIVE_TYPE;
  switch (archiveType) {
    case "instagram":
      await instagramHandler({ event, context, callback });
      break;
    case "dailyprince":
      await dailyPrinceHandler({ event, context, callback });
      break;
    case "newsletter":
      await newsLetterHandler({ event, context, callback });
      break;
    default:
      console.log(`Unknown archive type: ${archiveType}`);
  }

  return {
    statusCode: 200,
  };
};
