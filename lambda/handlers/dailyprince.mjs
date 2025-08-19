import dotenv from "dotenv";
import {
  generateAltoFile,
  extractText,
  generateMetsFile,
} from "./../util/mets_alto_dp.mjs";
import { putToS3, instantiateS3, formatTimestamp } from "./../util/helper.mjs";
import { PDFDocument } from "pdf-lib";
import log from "./../util/logger.mjs";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";


dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Use articles only (url + optional title/content)
  const { articles = [] } = event || {};
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error("No articles provided in the event");
  }

  // Filter out any malformed entries (missing url), but keep order
  const validArticles = articles.filter(a => a && typeof a.url === "string" && a.url.length > 0);
  if (validArticles.length === 0) {
    throw new Error("No valid article URLs provided");
  }
  if (validArticles.length !== articles.length) {
    log.warn(`Some articles were skipped due to missing/invalid url`);  }

  // Instantiate AWS S3 and Puppeteer client
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-web-security", "--allow-insecure-localhost"],
  });
  log.info("Puppeteer client instantiated");

  // Capture articles from the provided list
  let startingPage = 1;
  const articlesData = [];
  for (const [index, art] of validArticles.entries()) {
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
  }
  await browser.close();

  // Merge all captured articles into a single PDF buffer
  const issueName = `dailyprincetonian_${formatTimestamp(new Date())}`;
  const pdfBuffers = articlesData.map((article) => article.pdfBuffer);
  const { mergedPdfBytes, pdfPath, imagesDir, pages } = await mergePDFBuffers({
    buffers: pdfBuffers,
    dir: issueName,
    dpi: 400,
    quality: 90,
    generateImages : false,
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

  const altoDir = path.join(path.dirname(pdfPath), "alto");
  fs.mkdirSync(altoDir, { recursive: true });

  const altoBuffers = [];
  const altoFiles = [];
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    // Use article content if this page is a start; otherwise generate a blank ALTO
    const pageText = pageStartContent.get(pageNum) || "";
    // Our JP2 naming pattern is "page-%04d.jp2"
    const sourceImageName = `page-${String(pageNum).padStart(4, "0")}.jp2`;

    const { altoBuffer, name } = generateAltoFile({
      dir: path.join(issueName, "alto"),
      pageText,                 // empty string => blank ALTO (no TextBlock)
      pageId: pageNum,          // 1-based numbering
      pageWidth: pageWidthPx,
      pageHeight: pageHeightPx,
      measurementUnit: "pixel",
      sourceImage: sourceImageName,
      downloadLocally: local,
      // schema: "v4", // or "docworks14" if you need that flavor
    
    });

    log.info(
      pageText
        ? `ALTO (with text) generated for page ${pageNum}: ${name}`
        : `ALTO (blank) generated for page ${pageNum}: ${name}`
    );
    altoBuffers.push({ buffer: altoBuffer, name });

    const baseDir = path.dirname(pdfPath);
    const absPath = path.join(baseDir, "alto", name); // on-disk path
    const relHref = `file://./alto/${name}`;
    
    altoFiles.push({
      page: pageNum,
      path: absPath,
      relHref,
      name,
      mimetype: "text/xml",
    });
  }

  log.info(`Generated ${altoBuffers.length} ALTO files (one per page; text only on start pages).`);

  const imageFiles = pages.map((p, idx) => ({
    page: idx + 1,            // 1-based page number
    path: p,                  // absolute JP2 path (or placeholder path)
    relHref: `file://./images/${path.basename(p)}`,
    name: path.basename(p),   // e.g., page-0001.jp2
  }));

  // Generate METS file from merged PDF buffer and ALTO files
  const metsResponse = generateMetsFile({
    articlesData,
    issueDate: event.today,
    dir: issueName,
    downloadLocally: local,
    imageFiles,
    altoFiles,
  });
  log.info("METS file generated");

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
  await page.goto(url, {
    timeout: 120000,
    waitUntil: ["networkidle2", "domcontentloaded"],
  });
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
  generateImages = false, // <-- set to true to actually write JP2s
}) => {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  // We can get the count before/after save; either is fine.
  const pageCount = mergedPdf.getPageCount();
  const mergedPdfBytes = await mergedPdf.save();

  const baseDir = path.resolve(process.cwd(), "documents", dir);
  const pdfPath = path.join(baseDir, `${dir}.pdf`);
  const imgOutDir = path.join(baseDir, "images");

  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(imgOutDir, { recursive: true }); // ensure dir exists even if we skip images
  fs.writeFileSync(pdfPath, mergedPdfBytes);

  let pages;
  if (generateImages) {
    // real JP2 generation
    pages = await pdfToJpegs({
      pdfPath,
      outDir: imgOutDir,
      dpi,
      quality,
    });
  } else {
    // placeholder filenames (not created) — consumers only need length;
    // keeping the expected naming prevents downstream surprises.
    pages = Array.from({ length: pageCount }, (_, i) =>
      path.join(imgOutDir, `page-${String(i + 1).padStart(4, "0")}.jp2`)
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