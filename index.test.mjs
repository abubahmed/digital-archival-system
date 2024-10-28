import { handler } from "./index.mjs";
import payload from "./payload.json" assert { type: "json" };

const webUrl = payload.webUrl;
console.log(webUrl);

handler({
  event: JSON.stringify(payload),
  context: {},
}).catch((e) => {
  console.error(e);
});
