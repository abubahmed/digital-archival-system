import { handler } from "./index.mjs";
import payload from "../events/payload.json" assert { type: "json" };

handler({
  instagramUrls: payload.instagramUrls,
  articleUrls: payload.articleUrls,
}).catch((e) => {
  console.error(e);
});
