import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { captureArticle } from "../util/api.mjs";
import { mergePDFBuffers } from "../util/helper.mjs";
import { generateAltoFile } from "../util/mets_alto.mjs";
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

  const articlesData = [];
  for (const [index, url] of event.webUrls.entries()) {
    const response = await captureArticle({
      url: url,
      browser: browser,
      header: index === 0,
      footer: index === event.webUrls.length - 1,
    });
    if (response.status === "error") {
      log.error(`Failed to capture article: ${message}`);
      continue;
    }
    articlesData.push(response);
  }
  if (articlesData.length === 0) {
    log.info("No articles captured");
    return {
      status: "error",
      message: "No articles captured",
    };
  }

  const mergedPdfBuffer = await mergePDFBuffers({
    buffers: articlesData.map(({ file }) => file),
    name: articlesData[0].name,
  });
  browser.close();
};
