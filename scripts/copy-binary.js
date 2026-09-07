import * as fs from "node:fs";
import * as path from "node:path";

const targetDir = path.resolve("src-tauri/target/release");
const outDir = path.resolve("dist/bin");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const primaryExeName = process.platform === "win32" ? "atrium-pi-modelprovider-manager.exe" : "atrium-pi-modelprovider-manager";
const legacyExeName = process.platform === "win32" ? "pi-modelprovider-manager.exe" : "pi-modelprovider-manager";

const primarySrc = path.join(targetDir, primaryExeName);
const legacySrc = path.join(targetDir, legacyExeName);

const srcExe = fs.existsSync(primarySrc) ? primarySrc : (fs.existsSync(legacySrc) ? legacySrc : null);

if (srcExe) {
  const destExe = path.join(outDir, primaryExeName);
  fs.copyFileSync(srcExe, destExe);
  // Also provide legacy alias copy if needed for transition
  fs.copyFileSync(srcExe, path.join(outDir, legacyExeName));
  console.log(`[build:tauri] Successfully copied binary to: ${destExe}`);
} else {
  console.warn(`[build:tauri] Binary not found at: ${primarySrc} or ${legacySrc}`);
}
