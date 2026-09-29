import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = ["server.js", "script.js", "analytics.js", "analytics-config.js"];
for (const dir of ["lib", "api", "scripts", "tests"]) {
  files.push(
    ...readdirSync(dir)
      .filter((file) => /\.m?js$/.test(file))
      .map((file) => `${dir}/${file}`),
  );
}
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax verified: ${files.length} files.`);
