import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Resolve TypeScript-style imports for the test runner.
 *
 * Two things Node does not do on its own but Next.js does:
 *   • the `@/` path alias from tsconfig
 *   • extensionless specifiers ("./taste" → taste.ts, "@/lib/vector" → index.ts)
 *
 * Teaching the resolver both means the suites import the modules that actually
 * ship — real source, real types stripped at load — rather than a copy that can
 * drift away from the implementation it claims to test.
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json"];

function firstExisting(base) {
  if (existsSync(base) && !existsSync(path.join(base, "package.json"))) {
    // A directory needs an index; a file is used as-is.
    if (!path.extname(base)) {
      for (const ext of EXTENSIONS) {
        const indexed = path.join(base, `index${ext}`);
        if (existsSync(indexed)) return indexed;
      }
    } else {
      return base;
    }
  }
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexed = path.join(base, `index${ext}`);
    if (existsSync(indexed)) return indexed;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let absolute = null;

  if (specifier.startsWith("@/")) {
    absolute = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    absolute = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (absolute) {
    const resolved = firstExisting(absolute);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}
