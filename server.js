import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createApp } from "./lib/app.js";

const app = createApp();
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`SimpleChurch: http://localhost:${port}`));
}
export default app;
