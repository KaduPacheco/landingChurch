import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createApp } from "./lib/app.js";

const app = createApp();
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const portIndex = process.argv.indexOf("--port");
  const port = Number(process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 3000));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid server port");
  app.listen(port, () => console.log(`SimpleChurch: http://localhost:${port}`));
}
export default app;
