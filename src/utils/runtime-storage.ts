import os from "node:os";
import path from "node:path";

export function getRuntimeStorageDir(env = process.env, home = os.homedir()): string {
  const root = path.join(home, ".pi", "pi-modelprovider-manager-data");
  return env.PI_MODEL_MANAGER_ENV === "development" ? path.join(root, "dev-cache") : root;
}
