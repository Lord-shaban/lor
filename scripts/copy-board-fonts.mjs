import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = resolve(dirname(require.resolve("@excalidraw/excalidraw")), "fonts");
const target = fileURLToPath(new URL("../apps/web/public/excalidraw/fonts", import.meta.url));
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
