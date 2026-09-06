import { spawnSync } from "node:child_process";

const env = { ...process.env, PI_MODEL_MANAGER_ENV: "development" };
for (const command of ["node scripts/generate-presets.mjs", "pnpm build:ext", "pnpm tauri dev"]) {
  const result = spawnSync(command, { shell: true, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
