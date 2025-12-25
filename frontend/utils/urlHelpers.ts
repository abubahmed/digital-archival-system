export function normalizeUrls(urlsText: string): string[] {
  return urlsText
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}
