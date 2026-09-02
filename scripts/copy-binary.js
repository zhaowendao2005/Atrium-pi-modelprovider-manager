import * as fs from "node:fs";
import * as path from "node:path";

const targetDir = path.resolve("src-tauri/target/release");
const outDir = path.resolve("dist/bin");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const exeName = process.platform === "win32" ? "pi-modelprovider-manager.exe" : "pi-modelprovider-manager";
const srcExe = path.join(targetDir, exeName);
const destExe = path.join(outDir, exeName);

if (fs.existsSync(srcExe)) {
  fs.copyFileSync(srcExe, destExe);
  console.log(`[build:tauri] Successfully copied binary to: ${destExe}`);
} else {
  console.warn(`[build:tauri] Binary not found at: ${srcExe}`);
}
