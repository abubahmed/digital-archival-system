import dotenv from "dotenv";
import { captureArticle } from "../util/fetch_data.mjs";
import { mergePDFBuffers, formatTimestamp } from "../util/misc_helper.mjs";
import { generateAltoFile, extractText, generateMetsFile } from "./../util/mets_alto_dp.mjs";
import { putToS3, instantiateS3 } from "./../util/s3_helper.mjs";
import log from "./../util/logger.mjs";
import puppeteer from "puppeteer";

dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;
  if (event.webUrls.length === 0) throw new Error("No URLs provided in the event");

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
      downloadLocally: local,
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
