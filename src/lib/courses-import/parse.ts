import "server-only";

import type { PinnedSource } from "./source";
import type { CountiesFile, CoursesFile } from "./types";

/**
 * The upstream `src/counties.js` / `src/courses.js` are ES modules of the form
 * `const X = {…}; export default X`. Rather than write a temp file + dynamic-
 * import (the CLI's approach - awkward on a serverless filesystem), we strip
 * the `export default` line and evaluate the body in an isolated function,
 * returning the object. The input is our own private repo, fetched server-side
 * behind the admin gate - not user input.
 */
function evalDefaultExport<T>(moduleText: string): T {
  const match = moduleText.match(/export\s+default\s+([A-Za-z0-9_$]+)\s*;?/);
  if (!match || match.index === undefined) {
    throw new Error("Upstream file has no `export default` - shape changed?");
  }
  const name = match[1];
  const body = moduleText.slice(0, match.index) + moduleText.slice(match.index + match[0].length);
  const factory = new Function(`"use strict";${body}\n;return ${name};`) as () => T;
  return factory();
}

export async function parseCounties(source: PinnedSource): Promise<CountiesFile> {
  return evalDefaultExport<CountiesFile>(await source.fetchText("src/counties.js"));
}

export async function parseCourses(source: PinnedSource): Promise<CoursesFile> {
  return evalDefaultExport<CoursesFile>(await source.fetchText("src/courses.js"));
}
