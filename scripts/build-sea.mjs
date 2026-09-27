/**
 * Builds a standalone executable of Reinvent:Match for the OS and CPU it runs on (Node single executable
 * application): the CLI and server bundled into one CommonJS file, the web UI embedded as assets, injected into a
 * copy of the running Node binary. No Node install needed to run the result.
 *
 *   npm run build && node scripts/build-sea.mjs
 *
 * Output: build/sea/reinvent-match-<platform>-<arch>[.exe]. CI runs it once per OS (.github/workflows/release.yml).
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { build } from "esbuild";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "build", "sea");
const webDist = join(root, "dist", "web");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const platform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
const exe = join(out, `reinvent-match-${platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. One CommonJS file: SEA runs a single script, not ES modules. import.meta.url is rebuilt from __filename.
const bundle = join(out, "app.cjs");
await build({
  entryPoints: [join(root, "dist", "cli.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: bundle,
  define: { "import.meta.url": "__importMetaUrl" },
  banner: { js: 'const __importMetaUrl = require("node:url").pathToFileURL(__filename).href;' },
  logLevel: "warning",
});

// 2. The web UI as assets, listed in a manifest so the app can write them out on first run.
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(webDist, path).split(sep).join("/"));
  }
};
walk(webDist);
const manifest = { build: `${pkg.version}-${Date.now().toString(36)}`, files };
writeFileSync(join(out, "web-manifest.json"), JSON.stringify(manifest));
const assets = { "web-manifest.json": join(out, "web-manifest.json") };
for (const file of files) assets[`web/${file}`] = join(webDist, file);

// 3. The SEA blob.
const config = join(out, "sea-config.json");
const blob = join(out, "sea-prep.blob");
writeFileSync(
  config,
  JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, assets }),
);
execFileSync(process.execPath, ["--experimental-sea-config", config], { stdio: "inherit" });

// 4. Inject it into a copy of this Node binary (re-signed ad hoc on macOS, where an edited binary must be signed).
copyFileSync(process.execPath, exe);
if (process.platform === "darwin") execFileSync("codesign", ["--remove-signature", exe]);
const postject = join(root, "node_modules", "postject", "dist", "cli.js");
execFileSync(
  process.execPath,
  [
    postject,
    exe,
    "NODE_SEA_BLOB",
    blob,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : []),
  ],
  { stdio: "inherit" },
);
if (process.platform === "darwin") execFileSync("codesign", ["--sign", "-", exe]);

console.log(`\nBuilt ${relative(root, exe)} (${(statSync(exe).size / 1e6).toFixed(0)} MB)`);
