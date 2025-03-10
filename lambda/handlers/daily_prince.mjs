import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
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
    headless: false,
  });
  log.info("Puppeteer client instantiated");
  
};
