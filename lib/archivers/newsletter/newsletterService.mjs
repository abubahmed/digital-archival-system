import mailchimp from "@mailchimp/mailchimp_marketing";
import { PDFDocument } from "pdf-lib";

/**
 * Fetches newsletters from Mailchimp within a date window
 * @param {Object} options
 * @param {Date} options.start - Start date of the window
 * @param {Date} options.end - End date of the window
 * @param {number} options.pageSize - Number of results per page (default: 100)
 * @param {string} options.apiKey - Mailchimp API key
 * @param {string} options.server - Mailchimp server (default: "us7")
 * @returns {Promise<Object>} Object with newsletters array
 */
export const fetchNewslettersInWindow = async ({ 
  start, 
  end, 
  pageSize = 100,
  apiKey,
  server = "us7"
}) => {
  if (!apiKey) {
    throw new Error("Mailchimp API key is required");
  }

  mailchimp.setConfig({
    apiKey,
    server,
  });

  const since_send_time = start.toISOString();
  let offset = 0;
  const all = [];

  while (true) {
    const resp = await mailchimp.campaigns.list({
      count: pageSize,
      offset,
      since_send_time,
      sort_field: "create_time",
      sort_dir: "ASC",
    });

    const batch = resp?.campaigns ?? [];
    if (batch.length === 0) break;

    all.push(...batch);
    offset += batch.length;

    const lastCreate = batch[batch.length - 1]?.create_time;
    if (lastCreate && new Date(lastCreate) >= end) break;
  }

  const inWindow = all.filter((c) => {
    if (!(c?.long_archive_url && c?.archive_url && c?.id)) return false;
    const ts = c.send_time ? new Date(c.send_time) : (c.create_time ? new Date(c.create_time) : null);
    if (ts && ts >= start && ts < end) {
      return true;
    }
    return false;
  });

  inWindow.sort((a, b) => {
    const aT = new Date(a.send_time ?? a.create_time);
    const bT = new Date(b.send_time ?? b.create_time);
    return aT - bT;
  });

  return { newsletters: inWindow };
};

/**
 * Captures a newsletter URL as a PDF using Puppeteer
 * @param {Object} options
 * @param {string} options.url - Newsletter archive URL
 * @param {Object} options.browser - Puppeteer browser instance
 * @returns {Promise<Buffer>} PDF buffer
 */
export const captureNewsletter = async ({ url, browser }) => {
  const page = await browser.newPage();

  const domain = new URL(url).host;
  await page.setCookie({
    name: "max-age",
    value: `${60 * 60 * 24 * 2}`,
    url,
    domain,
    path: "/",
    expires: Date.now() + 2 * 24 * 60 * 60 * 1000,
    "max-age": 60 * 60 * 24 * 2,
  });

  await page.goto(url, {
    timeout: 120000,
    waitUntil: ["networkidle2", "domcontentloaded"],
  });

  await page.evaluate(() => {
    const targetItems = document.querySelectorAll("#awesomebar");
    targetItems.forEach((item) => item.remove());
  });

  const iframes = await page.$$("iframe");
  await Promise.all(iframes.map((el) => el.contentFrame()));
  await new Promise((r) => setTimeout(r, 1000));

  const pdfBuffer = await page.pdf({
    width: "8.5in",
    height: "11in",
    displayHeaderFooter: true,
  });

  await page.close();
  return pdfBuffer;
};

/**
 * Gets newsletters for a date range and captures them as PDFs
 * @param {Object} options
 * @param {Date} options.date - Start date
 * @param {Date} options.endDate - End date (optional, if not provided uses 24h window)
 * @param {Object} options.browser - Puppeteer browser instance
 * @param {string} options.apiKey - Mailchimp API key
 * @param {string} options.server - Mailchimp server (default: "us7")
 * @param {Function} options.logger - Optional logger function
 * @returns {Promise<Array|null>} Array of newsletter objects with pdfBuffer, pageCount, url, title, content, ts
 */
export const getNewsletterForDate = async ({ 
  date, 
  endDate, 
  browser,
  apiKey,
  server = "us7",
  logger = console
}) => {
  let start, end;
  logger.info?.(`[getNewsletterForDate] input -> date=${String(date)} | endDate=${String(endDate)}`);
  
  if (endDate) {
    // Date range provided
    start = date instanceof Date ? date : new Date(date);
    end = endDate instanceof Date ? endDate : new Date(endDate);
  } else {
    // Single date - use 24 hour window as before
    end = date instanceof Date ? date : new Date(date);
    start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  const { newsletters } = await fetchNewslettersInWindow({ start, end, pageSize: 100, apiKey, server });
  if (!newsletters || newsletters.length === 0) return null;

  // Ensure mailchimp is configured
  mailchimp.setConfig({
    apiKey,
    server,
  });

  const results = [];
  for (const post of newsletters) {
    const url = post.long_archive_url;
    const ts = new Date(post.send_time ?? post.create_time);

    let contentText = "";
    try {
      const contentResp = await mailchimp.campaigns.getContent(post.id);
      // Plain text version is often best:
      contentText = contentResp.plain_text || "";
      contentText = filterNewsletterText(contentText);
    } catch (err) {
      logger.warn?.(`Could not fetch campaign content for ${post.id}: ${err.message}`);
    }

    const pdfBuffer = await captureNewsletter({ url, browser });
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    results.push({
      pdfBuffer,
      pageCount,
      url,
      title: post.settings?.subject_line || "Daily Newsletter",
      content: contentText || post.settings?.preview_text || "",
      ts,
    });
  }

  return results;
};

/**
 * Filters and cleans newsletter text content
 * @param {string} raw - Raw newsletter text
 * @returns {string} Filtered and cleaned text
 */
export function filterNewsletterText(raw) {
  if (!raw) return "";

  let t = raw;

  // Strip Mailchimp merge tags that survive stripHtml (e.g., *|MC_PREVIEW_TEXT|*)
  t = t.replace(/\*\|[^|]+\|\*/g, "");

  // Helper: remove unmatched parentheses reliably
  function balanceParens(s) {
    // pass 1: remove unmatched ')'
    let out = "";
    let open = 0;
    for (const ch of s) {
      if (ch === "(") { open++; out += ch; }
      else if (ch === ")") {
        if (open > 0) { open--; out += ch; }
        // else skip this unmatched ')'
      } else {
        out += ch;
      }
    }
    // pass 2: remove any leftover unmatched '(' from right to left
    if (open > 0) {
      let res = "";
      for (let i = out.length - 1; i >= 0; i--) {
        const ch = out[i];
        if (ch === "(" && open > 0) { open--; continue; }
        res = ch + res;
      }
      out = res;
    }
    return out;
  }

  const kept = [];
  for (let line of t.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;

    // Remove inline URLs/mailto but keep surrounding text
    line = line
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\bmailto:\S+/gi, "");

    // Remove empty ()/[] and parens with no letters/digits inside
    line = line
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\((?:\s|[^\p{L}\p{N}])*\)/gu, "");

    // Balance parentheses (removes any remaining unmatched '(' or ')')
    line = balanceParens(line);

    // Clean up spacing around punctuation and parens
    line = line
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    // Boilerplate/tracking
    if (
      lower.includes("unsubscribe") ||
      lower.includes("update your preferences") ||
      lower.includes("why did i get this") ||
      lower.includes("copyright ©") ||
      lower.includes("add us to your address book") ||
      lower.includes("list-manage.com") ||
      lower.includes("view this email in your browser")
    ) continue;

    // "READ THE STORY/OPINION →" lines
    if (/^read (the )?(story|opinion)\b/i.test(line)) continue;

    // Divider lines
    if (/^[\s\-\u2014_*=]+$/.test(line)) continue;

    // Skip lines with almost no letters
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    if (letters < 3) continue;

    kept.push(line);
  }

  let out = kept.join("\n");

  // Hard cut only at "Referred by a friend"
  const idx = out.toLowerCase().indexOf("referred by a friend");
  if (idx !== -1) out = out.slice(0, idx);

  // Collapse whitespace
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  return out;
}

