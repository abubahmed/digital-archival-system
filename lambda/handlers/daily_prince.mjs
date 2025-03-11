import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { captureArticle } from "../util/api.mjs";
import { mergePDFBuffers } from "../util/helper.mjs";
import { generateAltoFile, extractText, generateMetsFile } from "../util/mets_alto.mjs";
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
    if (response.status === "error") {
      log.error(`Failed to capture article: ${message}`);
      continue;
    }
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

  const mergedPDFBuffer = await mergePDFBuffers({
    buffers: articlesData.map(({ pdfBuffer }) => pdfBuffer),
    name: articlesData[0].fileName,
  });

  const pages = await extractText({ buffer: mergedPDFBuffer });
  const altoBuffers = [];
  for (const page of pages) {
    const { status, message, altoBuffer, name } = generateAltoFile({
      pageText: page.text,
      pageId: page.number,
    });
    if (status === "error") {
      log.error(`Failed to generate ALTO file: ${message}`);
      return {
        status: "error",
        message: `Failed to generate ALTO file: ${message}`,
      };
    }
    altoBuffers.push({
      buffer: altoBuffer,
      name: name,
    });
  }

  const metsResponse = generateMetsFile({ articles: articlesData, altoBuffers: altoBuffers });
  if (metsResponse.status === "error") {
    log.error(`Failed to generate METS file: ${metsResponse.message}`);
    return {
      status: "error",
      message: `Failed to generate METS file: ${metsResponse.message}`,
    };
  }
  const metsBuffer = metsResponse.metsBuffer;
};
