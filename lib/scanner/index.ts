import { getRepoFileTree, getFileContent, RepoTreeItem } from "@/lib/github/app";
import { extractCandidatesFromFile, ApiCandidate } from "./patterns";

export interface ScanResult {
  repositoryId: string;
  repositoryName: string;
  totalFilesFound: number;
  filesScanned: number;
  filesIgnored: number;
  candidates: ApiCandidate[];
  scannedAt: string;
}

// Ignore directories and file patterns specified in spec.md
const IGNORED_DIRECTORY_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "vendor/",
  "target/",
  ".turbo/",
  ".cache/",
];

const IGNORED_FILE_SUFFIXES = [
  ".lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".min.js",
  ".min.css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
];

const ALLOWED_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rb",
  ".java",
  ".cs",
  ".php",
  ".json",
];

/**
 * Checks whether a repository path should be ignored by the scanner.
 */
export function isPathIgnored(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");

  // Check ignored directory prefixes
  for (const prefix of IGNORED_DIRECTORY_PREFIXES) {
    if (normalized.startsWith(prefix) || normalized.includes(`/${prefix}`)) {
      return true;
    }
  }

  // Check ignored file suffixes or names
  for (const suffix of IGNORED_FILE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return true;
    }
  }

  // Check for generated files
  if (normalized.includes(".generated.") || normalized.includes(".d.ts")) {
    return true;
  }

  // Must have an allowed source code extension
  const hasAllowedExt = ALLOWED_SOURCE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
  if (!hasAllowedExt) {
    return true;
  }

  return false;
}

/**
 * Scans a repository for API usage patterns and extracts API candidates.
 */
export async function scanRepository(
  repositoryId: string,
  owner: string,
  name: string,
  installationId: string,
  defaultBranch = "main"
): Promise<ScanResult> {
  // 1. Fetch file tree
  const tree = await getRepoFileTree(owner, name, installationId, defaultBranch);

  let filesScanned = 0;
  let filesIgnored = 0;
  const candidates: ApiCandidate[] = [];

  // 2. Filter files
  const candidateBlobs: RepoTreeItem[] = [];
  for (const item of tree) {
    if (item.type !== "blob") continue;

    if (isPathIgnored(item.path)) {
      filesIgnored++;
    } else {
      candidateBlobs.push(item);
    }
  }

  // 3. Process candidate source files
  for (const file of candidateBlobs) {
    const content = await getFileContent(owner, name, file.path, installationId);
    if (!content) continue;

    filesScanned++;
    const fileCandidates = extractCandidatesFromFile(file.path, content);
    candidates.push(...fileCandidates);
  }

  return {
    repositoryId,
    repositoryName: `${owner}/${name}`,
    totalFilesFound: tree.length,
    filesScanned,
    filesIgnored,
    candidates,
    scannedAt: new Date().toISOString(),
  };
}
