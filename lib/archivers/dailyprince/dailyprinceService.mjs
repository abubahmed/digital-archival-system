import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";

/**
 * Captures an article URL as a PDF using Puppeteer
 * @param {Object} options
 * @param {string} options.url - Article URL
 * @param {Object} options.browser - Puppeteer browser instance
 * @param {boolean} options.header - Whether this is the first article (affects header removal)
 * @param {boolean} options.footer - Whether this is the last article (affects footer removal)
 * @param {number} options.startingPage - Starting page number for this article
 * @param {string} options.title - Optional article title
 * @param {string} options.content - Optional article content
 * @param {Function} options.logger - Optional logger function
 * @returns {Promise<Object>} Object with pdfBuffer, pages array, url, title, content
 */
export const captureArticle = async ({
  url,
  browser,
  header,
  footer,
  startingPage,
  title,
  content,
  logger = console,
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
        logger.warn?.(`Network did not become idle for ${url}, but continuing anyway`);
      });

      break; // If we get here, page loaded successfully
    } catch (error) {
      lastError = error;
      retries--;
      logger.warn?.(`Failed to load ${url}, ${retries} retries remaining. Error: ${error.message}`);
      
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

  await page.close();

  return {
    pdfBuffer,
    pages: pages,
    url,
    title,
    content,
  };
};

/**
 * Merges multiple PDF buffers into a single PDF
 * @param {Object} options
 * @param {Array<Buffer>} options.buffers - Array of PDF buffers to merge
 * @param {string} options.dir - Directory name for output
 * @param {number} options.dpi - DPI for image generation (default: 400)
 * @param {number} options.quality - Quality for image generation (default: 90)
 * @param {boolean} options.generateImages - Whether to generate JP2 images
 * @param {boolean} options.writeToDisk - Whether to write files to disk
 * @returns {Promise<Object>} Object with mergedPdfBytes, pdfPath, imagesDir, pages array
 */
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

/**
 * Converts a PDF to JP2 images using ImageMagick
 * @param {Object} options
 * @param {string} options.pdfPath - Path to the PDF file
 * @param {string} options.outDir - Output directory for JP2 files
 * @param {number} options.dpi - DPI for conversion (default: 300)
 * @param {number} options.quality - Quality for conversion (default: 35)
 * @returns {Promise<Array<string>>} Array of file paths to generated JP2 images
 */
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

