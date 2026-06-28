import "server-only";

/**
 * Fetches the canonical course/county dataset from a pinned commit of the
 * (private) `Pinehollow-Studios/Fairways-web` repo - the same source the
 * `Vestige-ios/scripts/import-courses` CLI uses. Pinning to a concrete 40-char
 * SHA (never `main`, never a tag) keeps an import reproducible.
 *
 * Auth: needs a GitHub token with **Contents: read on Fairways-web**. Reuses
 * `GITHUB_DISPATCH_TOKEN` (the PAT already wired for the prod-deploy console)
 * unless `GITHUB_CONTENT_TOKEN` is set to override. The PAT's scope must
 * include Fairways-web, not just the iOS repo - a 403/404 here means the token
 * can't see the repo.
 */

export const FAIRWAYS_REPO =
  process.env.GITHUB_FAIRWAYS_REPO ?? "Pinehollow-Studios/Fairways-web";
const API = "https://api.github.com";

function token(): string | undefined {
  const t = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_DISPATCH_TOKEN;
  return t && t.trim() !== "" ? t.trim() : undefined;
}

export function fairwaysConfigured(): boolean {
  return Boolean(token());
}

function authHeaders(accept: string): HeadersInit {
  const t = token();
  if (!t) throw new Error("No GitHub token - set GITHUB_DISPATCH_TOKEN (or GITHUB_CONTENT_TOKEN).");
  return {
    Authorization: `Bearer ${t}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface PinnedSource {
  sha: string;
  fetchText: (path: string) => Promise<string>;
}

/** A source bound to one concrete commit SHA. */
export function pinnedSource(sha: string): PinnedSource {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Expected a 40-char commit SHA, got "${sha}".`);
  }
  return {
    sha,
    async fetchText(path: string): Promise<string> {
      const url = `${API}/repos/${FAIRWAYS_REPO}/contents/${path}?ref=${sha}`;
      const res = await fetch(url, {
        headers: authHeaders("application/vnd.github.raw"),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(
          `Couldn't fetch ${path}@${sha.slice(0, 7)} from ${FAIRWAYS_REPO} ` +
            `(${res.status} ${res.statusText}). Check the token has Contents:read on that repo.`,
        );
      }
      return res.text();
    },
  };
}

export interface FairwaysCommit {
  sha: string;
  message: string;
  date: string | null;
  htmlUrl: string;
}

/** The current HEAD commit of Fairways-web's default branch. */
export async function latestFairwaysCommit(): Promise<FairwaysCommit> {
  const ref = process.env.GITHUB_FAIRWAYS_REF ?? "main";
  const res = await fetch(`${API}/repos/${FAIRWAYS_REPO}/commits/${ref}`, {
    headers: authHeaders("application/vnd.github+json"),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Couldn't read ${FAIRWAYS_REPO}@${ref} (${res.status} ${res.statusText}).`);
  }
  const json = (await res.json()) as {
    sha: string;
    commit: { message: string; author?: { date?: string } };
    html_url: string;
  };
  return {
    sha: json.sha,
    message: json.commit.message.split("\n")[0] ?? "",
    date: json.commit.author?.date ?? null,
    htmlUrl: json.html_url,
  };
}

/** How many commits HEAD is ahead of `baseSha` (null if the compare fails). */
export async function commitsAhead(baseSha: string): Promise<number | null> {
  const ref = process.env.GITHUB_FAIRWAYS_REF ?? "main";
  const res = await fetch(
    `${API}/repos/${FAIRWAYS_REPO}/compare/${baseSha}...${ref}`,
    { headers: authHeaders("application/vnd.github+json"), cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { ahead_by?: number };
  return typeof json.ahead_by === "number" ? json.ahead_by : null;
}
