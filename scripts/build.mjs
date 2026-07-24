import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { staticFiles, verifyBuildFiles } from "./verify-build.mjs";

const outputDir = "dist";

verifyBuildFiles();
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of staticFiles) {
  const target = join(outputDir, file);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target, { recursive: true });
}

console.log(`Build output generated in ${outputDir}.`);