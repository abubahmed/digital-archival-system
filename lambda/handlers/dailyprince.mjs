import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { captureArticle } from "../util/api.mjs";
import { mergePDFBuffers, putToS3 } from "../util/helper.mjs";
import { generateAltoFile, extractText, generateMetsFile } from "../util/mets_alto_dp.mjs";
import { formatTimestamp } from "../util/helper.mjs";
import log from "../util/logger.mjs";
import puppeteer from "puppeteer";
dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Instantiate the AWS S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: local
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_KEY,
        }
      : undefined,
  });
  log.info("AWS S3 client instantiated");

  // Instantiate Puppeteer client
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
    if (response.status === "error") {
      log.error(`Failed to capture article: ${message}`);
      continue;
    }
    log.info(`Captured article: ${url}`);
    articlesData.push(response);
    startingPage += response.pages.length;
  }
  browser.close();
  if (articlesData.length === 0) {
    log.info("No articles captured");
    return {
      status: "error",
      message: "No articles captured",
    };
  }

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
    const { status, message, altoBuffer, name } = generateAltoFile({
      dir: issueName,
      pageText: page.text,
      pageId: page.number,
      downloadLocally: local,
    });
    if (status === "error") {
      log.error(`Failed to generate ALTO file: ${message}`);
      return {
        status: "error",
        message: `Failed to generate ALTO file: ${message}`,
      };
    }
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
  if (metsResponse.status === "error") {
    log.error(`Failed to generate METS file: ${metsResponse.message}`);
    return {
      status: "error",
      message: `Failed to generate METS file: ${metsResponse.message}`,
    };
  }
  log.info("METS file generated");

  // Upload the merged PDF buffer, METS file, and ALTO files to S3
  const S3IssueResponse = await putToS3({
    file: mergedPDFBuffer,
    S3Client: s3Client,
    bucketName,
    path: `dailyprince/${issueName}/${issueName}.pdf`,
  });
  if (S3IssueResponse.status === "error" || S3IssueResponse?.response.$metadata.httpStatusCode != 200) {
    log.error("Failed to upload to S3");
    return {
      status: "error",
      message: "Failed to upload metadata to S3",
    };
  }
  log.info(`Issue PDF uploaded to S3: ${issueName}.pdf`);

  const S3MetadataResponse = await putToS3({
    file: metsResponse.buffer,
    S3Client: s3Client,
    bucketName,
    path: `dailyprince/${issueName}/mets.xml`,
  });
  if (S3MetadataResponse.status === "error" || S3MetadataResponse?.response.$metadata.httpStatusCode != 200) {
    log.error("Failed to upload metadata to S3");
    return {
      status: "error",
      message: "Failed to upload metadata to S3",
    };
  }
  log.info(`METS file uploaded to S3: mets.xml`);

  for (const altoBuffer of altoBuffers) {
    const S3AltoResponse = await putToS3({
      file: altoBuffer.buffer,
      S3Client: s3Client,
      bucketName,
      path: `dailyprince/${issueName}/${altoBuffer.name}`,
    });
    if (S3AltoResponse.status === "error" || S3AltoResponse?.response.$metadata.httpStatusCode != 200) {
      log.error("Failed to upload ALTO file to S3");
      return {
        status: "error",
        message: "Failed to upload ALTO file to S3",
      };
    }
    log.info(`ALTO file uploaded to S3: ${altoBuffer.name}`);
  }
};
