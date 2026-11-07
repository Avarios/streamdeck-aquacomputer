// Bundles src/plugin.ts into the .sdPlugin folder and installs the native
// runtime dependency (node-hid) next to it.
import { build, context } from "esbuild";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const PLUGIN_DIR = "com.avarios.aquars.sdPlugin";
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/plugin.ts"],
  outfile: `${PLUGIN_DIR}/bin/plugin.js`,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: true,
  external: ["node-hid"], // native addon: must stay a real node_modules package
  logLevel: "info",
};

// node-hid ships prebuilt binaries (N-API), so it works with Stream Deck's bundled Node.
if (!existsSync(`${PLUGIN_DIR}/node_modules/node-hid`)) {
  console.log("Installing node-hid into the plugin folder ...");
  execSync("npm install --omit=dev --no-audit --no-fund", { cwd: PLUGIN_DIR, stdio: "inherit" });
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching ...");
} else {
  await build(options);
}
