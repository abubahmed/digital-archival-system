import dotenv from "dotenv";
import {
  generateAltoFile,
  generateMetsFile,
} from "./../util/mets_alto_dp.mjs";
import { getNewsletterForDate } from "./newsletter.mjs";
import { putToS3, instantiateS3, formatTimestamp } from "./../util/helper.mjs";
import { PDFDocument } from "pdf-lib";
import log from "./../util/logger.mjs";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { stripHtml } from "./../util/daily_run.mjs";


dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
  const local = false;
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Use articles only (url + optional title/content)
  const { articles = [] } = event || {};
  
  // If no articles provided, return early with success but no content
  if (!Array.isArray(articles) || articles.length === 0) {
    log.info("No articles found for this date");
    return {
      ok: true,
      noContent: true,
      message: "No articles found for this date"
    };
  }

  // Filter out any malformed entries (missing url), but keep order
  const validArticles = articles.filter(a => a && typeof a.url === "string" && a.url.length > 0);
  if (validArticles.length === 0) {
    log.info("No valid article URLs found for this date");
    return {
      ok: true,
      noContent: true,
      message: "No valid article URLs found for this date"
    };
  }
  if (validArticles.length !== articles.length) {
    log.warn(`Some articles were skipped due to missing/invalid url`);  }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      "--disable-web-security",
      "--allow-insecure-localhost",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ],
  });
  //log.info("Puppeteer client instantiated");

  // Capture articles from the provided list
  let startingPage = 1;
  const articlesData = [];

  try {
    const anchorDate = event.today instanceof Date ? event.today : new Date();
    const newsletter = await getNewsletterForDate({ date: anchorDate, browser });
    if (newsletter) {
      const pages = Array.from({ length: newsletter.pageCount }, (_, i) => startingPage + i);

      articlesData.push({
        pdfBuffer: newsletter.pdfBuffer,
        pages,
        url: newsletter.url,
        title: stripHtml(newsletter.title),
        content: stripHtml(newsletter.content),
      });

      startingPage += newsletter.pageCount;
      log.info(`Prepended newsletter (${newsletter.pageCount} pages)`);
    } else {
      log.info(`No newsletter found for window [${new Date(anchorDate - 86400000).toISOString()} to ${anchorDate.toISOString()}]`);
    }
    for (const [index, art] of validArticles.entries()) {
      try {
        const response = await captureArticle({
          url: art.url,
          browser,
          header: index === 0,
          footer: index === validArticles.length - 1,
          startingPage,
          // pass through metadata (optional)
          title: art.title,
          content: art.content,
        });
        log.info(`Captured article: ${art.url}`);
        articlesData.push(response);
        startingPage += response.pages.length;
      } catch (error) {
        log.error(`Failed to capture article ${art.url}: ${error.message}`);
        // Continue with next article instead of failing completely
        continue;
      }
    }

    // If we had valid articles but couldn't capture any of them, that's a failure
    if (articlesData.length === 0) {
      throw new Error(`Failed to capture any of the ${validArticles.length} articles. Please check the logs for specific errors.`);
    }
  } finally {
    await browser.close();
  }

  // Merge all captured articles into a single PDF buffer
  const issueName = `dailyprincetonian_${formatTimestamp(new Date())}`;
  const pdfBuffers = articlesData.map((article) => article.pdfBuffer);
  const generateImages = process.env.GENERATE_IMAGES === 'true';  // Environment variable control for image generation
  const { mergedPdfBytes, pdfPath, imagesDir, pages } = await mergePDFBuffers({
    buffers: pdfBuffers,
    dir: issueName,
    dpi: 400,
    quality: 90,
    generateImages,
    writeToDisk: generateImages, // Need this true to generate images
  });
  log.info("Merged PDF buffer created");

  const pageStartContent = new Map();
  // If two articles start on the same page, join their content with blank lines
  for (const art of articlesData) {
    const startPage = Array.isArray(art.pages) && art.pages.length ? art.pages[0] : null;
    if (!startPage) continue;
    const text = (art.content || "").trim();
    if (!text) continue;
    pageStartContent.set(
      startPage,
      pageStartContent.has(startPage)
        ? `${pageStartContent.get(startPage)}\n\n${text}`
        : text
    );
  }

  // --- Dimensions to match your JP2s (8.5x11 at the same DPI used above)
  const dpiUsed = 400; // keep in sync with mergePDFBuffers({ dpi })
  const pageWidthPx = Math.round(8.5 * dpiUsed);
  const pageHeightPx = Math.round(11 * dpiUsed);

  // 'pages' is the array of JP2 file paths returned by pdfToJpegs, so total pages:
  const totalPages = pages.length;

  const altoBuffers = [];
  const altoFiles = [];
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    // Use article content if this page is a start; otherwise generate a blank ALTO
    const pageText = pageStartContent.get(pageNum) || "";
    // Our JP2 naming pattern is "page-%04d.jp2"
    const sourceImageName = `page-${String(pageNum).padStart(4, "0")}.jp2`;

    const { altoBuffer, name } = generateAltoFile({
      dir: path.posix.join(issueName, "alto"),
      pageText,                 // empty string => blank ALTO (no TextBlock)
      pageId: pageNum,          // 1-based numbering
      pageWidth: pageWidthPx,
      pageHeight: pageHeightPx,
      measurementUnit: "pixel",
      sourceImage: sourceImageName,
      downloadLocally: false,
      // schema: "v4", // or "docworks14" if you need that flavor
    
    });

    log.info(
      pageText
        ? `ALTO (with text) generated for page ${pageNum}: ${name}`
        : `ALTO (blank) generated for page ${pageNum}: ${name}`
    );
    altoBuffers.push({ buffer: altoBuffer, name });

    const relHref = `file://./alto/${name}`;
    
    altoFiles.push({
      page: pageNum,
      relHref,
      name,
      mimetype: "text/xml",
    });
  }

  log.info(`Generated ${altoBuffers.length} ALTO files (one per page; text only on start pages).`);

  const imageFiles = pages.map((p, idx) => ({
    page: idx + 1,            // 1-based page number
    relHref: `file://./images/${path.basename(p)}`,
    name: path.basename(p),   // e.g., page-0001.jp2
  }));

  // Generate METS file from merged PDF buffer and ALTO files
  const metsResponse = generateMetsFile({
    articlesData,
    issueDate: event.today,
    dir: issueName,
    downloadLocally: false,
    imageFiles,
    altoFiles,
    issueNumber: 1,
    volumeNumber: 147, // hardcoded for now; update as needed
  });
  log.info("METS file generated");

  const artifacts = {
    pdf: { name: `${issueName}.pdf`, data: Buffer.from(mergedPdfBytes).toString("base64") },
    mets: { name: "mets.xml", data: Buffer.from(metsResponse.buffer, "utf-8").toString("base64") },
    alto: altoBuffers.map(({ buffer, name }) => ({
      name,
      data: buffer.toString("base64"),
    }))
  };
  
  // Only add images to artifacts if they were generated
  if (generateImages) {
    artifacts.images = pages.map(imagePath => ({
      name: path.basename(imagePath),
      data: fs.readFileSync(imagePath).toString("base64")
    }));
  }

  return {
    ok: true,
    issueName,
    issueDate: event.today?.toISOString?.().slice(0,10),
    artifacts
  };

  /*
  // Upload the merged PDF buffer, METS file, and ALTO files to S3
  await putToS3({
    file: mergedPDFBuffer,
    S3Client: s3Client,
    bucketName,
    path: `dailyprince/${issueName}/${issueName}.pdf`,
  });
  log.info(`Issue PDF uploaded to S3: ${issueName}.pdf`);

  await putToS3({
    file: metsResponse.buffer,
    S3Client: s3Client,
    bucketName,
    path: `dailyprince/${issueName}/mets.xml`,
  });
  log.info(`METS file uploaded to S3: mets.xml`);

  for (const altoBuffer of altoBuffers) {
    await putToS3({
      file: altoBuffer.buffer,
      S3Client: s3Client,
      bucketName,
      path: `dailyprince/${issueName}/${altoBuffer.name}`,
    });
    log.info(`ALTO file uploaded to S3: ${altoBuffer.name}`);
  }
  */
};

const captureArticle = async ({
  url,
  browser,
  header,
  footer,
  startingPage,
  title,
  content,
}) => {
  let page;
  let retries = 3; // Number of retries
  let lastError;

  while (retries > 0) {
    try {
      page = await browser.newPage();
      const domain = new URL(url).host;
      const cookies = [
        {
          name: "max-age",
          value: `${60 * 60 * 24 * 2}`,
          url: url,
          domain: domain,
          path: "/",
          expires: new Date().getTime(),
          "max-age": 60 * 60 * 24 * 2,
        },
      ];
      await page.setCookie(...cookies);

      // Set a shorter timeout for initial response
      const response = await page.goto(url, {
        timeout: 30000, // 30 seconds for initial response
        waitUntil: "domcontentloaded" // Start with just DOM loaded
      });

      if (!response) {
        throw new Error("No response received from page");
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Now wait for network to be idle, but with a longer timeout
      await page.waitForNetworkIdle({ 
        timeout: 60000, // 60 seconds for network idle
        idleTime: 1000  // 1 second of no network activity
      }).catch(() => {
        log.warn(`Network did not become idle for ${url}, but continuing anyway`);
      });

      break; // If we get here, page loaded successfully
    } catch (error) {
      lastError = error;
      retries--;
      log.warn(`Failed to load ${url}, ${retries} retries remaining. Error: ${error.message}`);
      
      if (page) {
        await page.close().catch(() => {}); // Ignore close errors
      }
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      }
    }
  }

  if (retries === 0) {
    throw new Error(`Failed to load ${url} after multiple attempts. Last error: ${lastError.message}`);
  }
  await page.evaluate(
    (header, footer) => {
      let targetElements = "related";
      if (!header) targetElements += ", header, .promo-bar";
      if (!footer) targetElements += ", footer";
      const targetItems = document.querySelectorAll(targetElements);
      targetItems.forEach((item) => item.remove());
    },
    header,
    footer,
  );

  await page.addStyleTag({
    content: `
        @page {
          margin: 1in 0 1in 0;
        }
        @page :first {
          margin-top: 0.5in;
          margin-bottom: 1in;
        }

        /* For daily newsletter scraping */
        /* (yes, it's actually called this.) */
        #awesomebar {
          display: none;
        }
      `,
  });
  const iframes = await page.$$("iframe");
  const iframePromises = iframes.map(async (iframeElement) => {
    await iframeElement.contentFrame();
  });
  await Promise.all(iframePromises);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const pdfOptions = {
    width: "8.5in",
    height: "11in",
    displayHeaderFooter: true,
  };
  const pdfBuffer = await page.pdf(pdfOptions);
  const pdfLoaded = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfLoaded.getPageCount();
  const pages = Array.from({ length: pageCount }, (_, i) => startingPage + i);

  return {
    pdfBuffer,
    pages: pages,
    url,
    title,
    content,
  };
};

export const mergePDFBuffers = async ({
  buffers,
  dir,
  dpi = 400,
  quality = 90,
  generateImages = false,
  writeToDisk = false,
}) => {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  const mergedPdfBytes = await mergedPdf.save();
  const pageCount = mergedPdf.getPageCount();

  let pdfPath;        // undefined when writeToDisk=false
  let imgOutDir;      // always set (disk or logical path)

  if (writeToDisk) {
    const baseDir = path.resolve(process.cwd(), "documents", dir);
    pdfPath = path.join(baseDir, `${dir}.pdf`);
    imgOutDir = path.join(baseDir, "images");

    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(imgOutDir, { recursive: true });
    fs.writeFileSync(pdfPath, mergedPdfBytes);
  } else {
    // logical folder name only; used for HREFs/ZIP paths
    imgOutDir = path.posix.join("images");
  }

  let pages;
  if (generateImages) {
    if (!writeToDisk) {
      throw new Error("generateImages=true requires writeToDisk=true (needs a real pdfPath).");
    }
    pages = await pdfToJpegs({
      pdfPath,
      outDir: imgOutDir,
      dpi,
      quality,
    });
  } else {
    // placeholders for METS/ZIP naming; no files written
    pages = Array.from({ length: pageCount }, (_, i) =>
      path.posix.join(imgOutDir, `page-${String(i + 1).padStart(4, "0")}.jp2`)
    );
  }

  return { mergedPdfBytes, pdfPath, imagesDir: imgOutDir, pages };
};

export async function pdfToJpegs({
  pdfPath,
  outDir,
  dpi = 300,
  quality = 35,
}) {
  if (!pdfPath) throw new Error("pdfToJpegs: pdfPath is required");
  if (!outDir) throw new Error("pdfToJpegs: outDir is required");

  await mkdir(outDir, { recursive: true });
  const outPattern = path.join(outDir, "page-%04d.jp2");

  // magick -density <dpi> input.pdf -background white -alpha remove -quality <q> out/page-%04d.jp2
  await new Promise((resolve, reject) => {
    execFile(
      "magick",
      [
        "-density", String(dpi),
        pdfPath,
        "-background", "white",
        "-alpha", "remove",
        "-quality", String(quality),
        outPattern,
      ],
      (err) => (err ? reject(err) : resolve())
    );
  });

  // Return the list of files we just wrote
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.toLowerCase().endsWith(".jp2"))
    .map((f) => path.join(outDir, f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return files;
}