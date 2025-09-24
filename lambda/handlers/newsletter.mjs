import { formatTimestamp, putToS3, instantiateS3, sanitizeFileName } from "../util/helper.mjs";
import fs from "fs";
import path from "path";
import mailchimp from "@mailchimp/mailchimp_marketing";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

dotenv.config();

/**
 * Handler: archives any Mailchimp campaigns sent in the 24 hours before `event.date`.
 * - `event.date` (optional): a JS Date; defaults to new Date().
 *   Window = [date - 24h, date)
 */
export const newsletterHandler = async ({ event, context, callback }) => {
  //const local = process.env.LOCAL;
  const local = true; // For testing purposes, set to true
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Resolve end date (default: now) and start = end - 24h
  const end = event?.date instanceof Date ? event.date : new Date();
  if (isNaN(end.getTime())) throw new Error("Invalid event.date; must be a Date");
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-web-security", "--allow-insecure-localhost"],
  });
  log.info("Puppeteer client instantiated");

  try {
    const { newsletters } = await fetchNewslettersInWindow({ start, end, pageSize: 100 });
    if (newsletters.length === 0) {
      log.info(`No newsletters found in window ${start.toISOString()} to ${end.toISOString()}`);
      return;
    }

    if (newsletters.length > 1) {
      log.info(`Found ${newsletters.length} newsletters in the window; processing all.`);
    }

    let processed = 0;
    for (const post of newsletters) {
      processed++;
      log.info(`Processing ${processed}/${newsletters.length}`);

      const { long_archive_url, send_time, create_time } = post;
      const ts = new Date(send_time ?? create_time);
      const fileName = `${sanitizeFileName(long_archive_url)}_${formatTimestamp(ts)}.pdf`;

      const pdfBuffer = await captureNewsletter({ url: long_archive_url, browser });

      if (local) {
        const localPath = `./documents/newsletters/${fileName}`;
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        fs.writeFileSync(localPath, pdfBuffer);
      }

      /*await putToS3({
        file: pdfBuffer,
        S3Client: s3Client,
        bucketName,
        path: `newsletters/${fileName}`,
      });*/
    }
  } finally {
    await browser.close();
  }
};

export const fetchNewslettersInWindow = async ({ start, end, pageSize = 100 }) => {
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: "us7",
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

const captureNewsletter = async ({ url, browser }) => {
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

export const getNewsletterForDate = async ({ date, endDate, browser }) => {
  let start, end;
  log.info(`[getNewsletterForDate] input -> date=${String(date)} | endDate=${String(endDate)}`);
  if (endDate) {
    // Date range provided
    start = date instanceof Date ? date : new Date(date);
    end = endDate instanceof Date ? endDate : new Date(endDate);
  } else {
    // Single date - use 24 hour window as before
    end = date instanceof Date ? date : new Date(date);
    start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  const { newsletters } = await fetchNewslettersInWindow({ start, end, pageSize: 100 });
  if (!newsletters || newsletters.length === 0) return null;

  const post = newsletters[newsletters.length - 1];
  const url = post.long_archive_url;
  const ts = new Date(post.send_time ?? post.create_time);

  let contentText = "";
  try {
    const contentResp = await mailchimp.campaigns.getContent(post.id);
    // Plain text version is often best:
    contentText = contentResp.plain_text || "";
    contentText = filterNewsletterText(contentText);
  } catch (err) {
    log.warn(`Could not fetch campaign content for ${post.id}: ${err.message}`);
  }

  const pdfBuffer = await captureNewsletter({ url, browser });
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  return {
    pdfBuffer,
    pageCount,
    url,
    title: post.settings?.subject_line || "Daily Newsletter",
    content: contentText || post.settings?.preview_text || "",
    ts,
  };
};

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

    // “READ THE STORY/OPINION →” lines
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

//await newsletterHandler({
//  event: { date: new Date("2023-09-13T10:00:00Z") }
//});