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

dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (event.webUrls.length === 0)
    throw new Error("No URLs provided in the event");

  // Instantiate AWS S3 and Puppeteer client
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-web-security", "--allow-insecure-localhost"],
  });
  log.info("Puppeteer client instantiated");

  // Capture articles from the provided URLs
  let startingPage = 1;
  const articlesData = [];
  for (const [index, url] of event.webUrls.entries()) {
    const response = await captureArticle({
      url: url,
      browser: browser,
      header: index === 0,
      footer: index === event.webUrls.length - 1,
      startingPage: startingPage,
    });
    log.info(`Captured article: ${url}`);
    articlesData.push(response);
    startingPage += response.pages.length;
  }
  browser.close();

  // Merge all captured articles into a single PDF buffer
  const issueName = `dailyprincetonian_${formatTimestamp(new Date())}`;
  const pdfBuffers = articlesData.map((article) => article.pdfBuffer);
  const mergedPDFBuffer = await mergePDFBuffers({
    buffers: pdfBuffers,
    dir: issueName,
  });
  log.info("Merged PDF buffer created");

  // Extract text from the merged PDF buffer and generate ALTO files
  const pages = await extractText({ buffer: mergedPDFBuffer });
  const altoBuffers = [];
  for (const page of pages) {
    const { altoBuffer, name } = generateAltoFile({
      dir: issueName,
      pageText: page.text,
      pageId: page.number,
      downloadLocally: local,
    });
    log.info(`ALTO file for page ${page.number} generated: ${name}`);
    altoBuffers.push({ buffer: altoBuffer, name: name });
  }

  // Generate METS file from merged PDF buffer and ALTO files
  const metsResponse = generateMetsFile({
    articlesData,
    altoBuffers: altoBuffers,
    dir: issueName,
    downloadLocally: local,
  });
  log.info("METS file generated");

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
};

const captureArticle = async ({
  url,
  browser,
  header,
  footer,
  startingPage,
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
  const articleTitle = await page.evaluate(() => {
    const hostname = new URL(document.URL).hostname;
    console.log(hostname);
    if (hostname === "mailchi.mp") {
      return "Newsletter";
    }
    const h1Element = document.querySelector(".article h1");
    return h1Element ? h1Element.textContent : null;
  });

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
    title: articleTitle,
    pages: pages,
    url,
  };
};

export const mergePDFBuffers = async ({ buffers, dir }) => {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedPdfBytes = await mergedPdf.save();
  const path = `./documents/${dir}/`;
  fs.mkdirSync(path, { recursive: true });
  fs.writeFileSync(`./documents/${dir}/${dir}.pdf`, mergedPdfBytes);
  return mergedPdfBytes;
};
