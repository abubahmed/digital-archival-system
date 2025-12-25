/**
 * URL helpers.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file urlHelpers.ts
 */

/**
 * Normalizes a list of URLs.
 *
 * @param {string} urlsText - The URLs text.
 *
 * @returns {string[]} The normalized URLs.
 */
export function normalizeUrls(urlsText: string): string[] {
  return urlsText
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}
