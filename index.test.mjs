import { handler } from "./index.mjs";
import payload from "./events/payload.json" assert { type: "json" };

handler({
  webUrl: payload.webUrl,
}).catch((e) => {
  console.error(e);
});
