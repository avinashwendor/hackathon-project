import type { WebContainer } from "@webcontainer/api";

export type WorkspaceFile = {
  name: string;
  language: string;
  content: string;
};

const EXCLUDED_DIRECTORIES = new Set([".git", ".next", "dist", "node_modules"]);
const TEXT_FILE_PATTERN =
  /(?:^|\/)(?:\.env(?:\..*)?|\.gitignore)$|\.(?:cjs|css|html|js|json|jsx|md|mjs|scss|svg|ts|tsx|txt|yaml|yml)$/i;

export function languageFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    cjs: "javascript",
    css: "css",
    html: "html",
    js: "javascript",
    json: "json",
    jsx: "javascript",
    md: "markdown",
    mjs: "javascript",
    scss: "scss",
    svg: "xml",
    ts: "typescript",
    tsx: "typescript",
    yaml: "yaml",
    yml: "yaml",
  };
  return languages[extension ?? ""] ?? "plaintext";
}

export function normalizeWorkspacePath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "..")) {
    return null;
  }
  return normalized;
}

export async function ensureParentDirectory(runtime: WebContainer, path: string) {
  const separator = path.lastIndexOf("/");
  if (separator > 0) {
    await runtime.fs.mkdir(path.slice(0, separator), { recursive: true });
  }
}

export async function scanWorkspace(runtime: WebContainer) {
  const files: WorkspaceFile[] = [];

  const visit = async (directory: string): Promise<void> => {
    const entries = await runtime.fs.readdir(directory || ".", { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) await visit(path);
        continue;
      }
      if (!entry.isFile() || !TEXT_FILE_PATTERN.test(path)) continue;

      try {
        files.push({
          name: path,
          language: languageFromName(path),
          content: await runtime.fs.readFile(path, "utf-8"),
        });
      } catch {
        // A generator may replace a file while the directory scan is in progress.
      }
    }
  };

  await visit("");
  return files;
}
