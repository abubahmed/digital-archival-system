import { handler } from "./index.mjs";

handler().catch((e) => {
  console.error(e);
});
