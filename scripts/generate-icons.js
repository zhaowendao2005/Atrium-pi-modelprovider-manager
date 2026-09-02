import * as fs from "node:fs";
import * as path from "node:path";

const iconsDir = path.resolve("src-tauri/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1x1 transparent/colored PNG base64
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAEZJREFUWIXt1zERAAAIAzHwbxpDOkg4eCrtZ5Pnqup2wFjA6wG8HsDrAbweIBYwFvB6AK8H8HoArweIBYwFvB6AK92A8AMU1C1l5H5K2QAAAABJRU5ErkJggg==";
const pngBuffer = Buffer.from(pngBase64, "base64");

// Write PNG icons
fs.writeFileSync(path.join(iconsDir, "32x32.png"), pngBuffer);
fs.writeFileSync(path.join(iconsDir, "128x128.png"), pngBuffer);
fs.writeFileSync(path.join(iconsDir, "128x128@2x.png"), pngBuffer);
fs.writeFileSync(path.join(iconsDir, "icon.png"), pngBuffer);

// Construct a minimal valid ICO file wrapping the PNG buffer
// ICO Header: 0, 1 (ICO type), 1 (number of images)
// Directory Entry: width, height, palette, reserved, planes (1), bpp (32), size, offset (22)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // image type (1 = icon)
header.writeUInt16LE(1, 4); // number of images

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(32, 0); // width (32)
dirEntry.writeUInt8(32, 1); // height (32)
dirEntry.writeUInt8(0, 2);  // color count
dirEntry.writeUInt8(0, 3);  // reserved
dirEntry.writeUInt16LE(1, 4); // color planes
dirEntry.writeUInt16LE(32, 6); // bits per pixel
dirEntry.writeUInt32LE(pngBuffer.length, 8); // image data size
dirEntry.writeUInt32LE(22, 12); // image data offset (6 + 16 = 22)

const icoBuffer = Buffer.concat([header, dirEntry, pngBuffer]);
fs.writeFileSync(path.join(iconsDir, "icon.ico"), icoBuffer);
fs.writeFileSync(path.join(iconsDir, "icon.icns"), pngBuffer);

console.log("[generate-icons] Successfully created icons in src-tauri/icons/");
