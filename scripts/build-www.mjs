// Usage: node ../../scripts/build-www.mjs   (run inside apps/<app>)
// Assembles www/: app html + shared js + offline vendor libs + local fonts.
import fs from "node:fs";
import path from "node:path";
const cwd = process.cwd(), root = path.resolve(cwd, "../..");
const www = path.join(cwd, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "vendor"), { recursive: true });
fs.mkdirSync(path.join(www, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(cwd, "src"))) fs.cpSync(path.join(cwd, "src", f), path.join(www, f), { recursive: true });
for (const f of ["native.js", "profiles.js"]) fs.copyFileSync(path.join(root, "shared", f), path.join(www, f));

const nm = p => path.join(cwd, "node_modules", p);
const first = (...c) => { for (const x of c) if (fs.existsSync(x)) return x; throw new Error("missing " + c.join(" | ")); };
fs.copyFileSync(first(nm("chart.js/dist/chart.umd.js"), nm("chart.js/dist/chart.umd.min.js")), path.join(www, "vendor/chart.umd.js"));
fs.copyFileSync(first(nm("xlsx/dist/xlsx.full.min.js")), path.join(www, "vendor/xlsx.full.min.js"));

// fonts: @fontsource latin subsets, rewritten to local paths
const want = [["fraunces", [500, 600]], ["archivo", [400, 500, 600, 700]], ["ibm-plex-mono", [400, 500, 600]]];
let css = "";
for (const [pkg, weights] of want) for (const w of weights) {
  const file = nm(`@fontsource/${pkg}/latin-${w}.css`);
  if (!fs.existsSync(file)) { console.warn("font css missing", file); continue; }
  let c = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  c = c.replace(/url\(\.\/files\/([^)]+)\)/g, (m, f) => {
    if (fs.existsSync(path.join(dir, "files", f))) fs.copyFileSync(path.join(dir, "files", f), path.join(www, "fonts", f));
    return `url(${f})`;
  }).replace(/src:\s*url\([^)]+\.woff2\)\s*format\("woff2"\),\s*url\([^)]+\.woff\)\s*format\("woff"\)/g, m => m.split(",")[0]);
  css += c + "\n";
}
fs.writeFileSync(path.join(www, "fonts/fonts.css"), css);
console.log("www ready:", fs.readdirSync(www).join(", "));
