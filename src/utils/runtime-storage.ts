import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getRuntimeStorageDir(env = process.env, home = os.homedir()): string {
  const legacyRoot = path.join(home, ".pi", "pi-modelprovider-manager-data");
  const atriumRoot = path.join(home, ".pi", "atrium-pi-modelprovider-manager-data");
  const root = fs.existsSync(atriumRoot) || !fs.existsSync(legacyRoot) ? atriumRoot : legacyRoot;
  return env.PI_MODEL_MANAGER_ENV === "development" ? path.join(root, "dev-cache") : root;
}
