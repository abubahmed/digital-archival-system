import { handler } from "./index.mjs";
import "module-alias/register";
import payload from "../events/payload.json" assert { type: "json" };

handler({
  webUrls: payload.webUrls,
}).catch((e) => {
  console.error(e);
});
