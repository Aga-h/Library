// Teaches the node test scripts the "@/..." path alias the app itself uses, so a pure module can
// import another pure module the same way the rest of the codebase does.
//
// Load before a test with: node --experimental-strip-types --import ./scripts/alias.mjs <test>
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolvePath(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const bare = resolvePath(root, specifier.slice(2));
    // A file, never a directory: lib/constants is a folder and must not match "@/lib/constants".
    const file = [bare, `${bare}.ts`, `${bare}.tsx`].find((p) => statSync(p, { throwIfNoEntry: false })?.isFile());
    if (!file) throw new Error(`alias.mjs: cannot resolve ${specifier}`);
    return nextResolve(pathToFileURL(file).href, context);
  },
});
