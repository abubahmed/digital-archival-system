// https://medium.com/@anuragchitti1103/how-to-run-puppeteer-on-aws-lambda-using-layers-763aea8bed8
import puppeteer from "puppeteer";
/**
import puppeteer from "/opt/puppeteer_layer/nodejs/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js";
import chromium from "/opt/puppeteer_layer/nodejs/node_modules/@sparticuz/chromium/build/index.js";
*/
import { captureArticle } from "./util/capture-article.mjs";
import { capturePost } from "./util/capturePost.mjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context, callback) => {
  console.log(event);
  console.log(context);
  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_KEY;
  const local = process.env.LOCAL;
  if (!bucketName || !region || (local && (!accessKeyId || !secretAccessKey))) {
    console.error("Missing environment variable(s)");
    return;
  }
  const browser = await puppeteer.launch({
    headless: false,
  });
  /**
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(
      process.env.AWS_EXECUTION_ENV
        ? "/opt/puppeteer_layer/nodejs/node_modules/@sparticuz/chromium/bin"
        : undefined
    ),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });*/
  const s3Client = new S3Client({
    region: region,
    credentials: local ? { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey } : undefined,
  });
  try {
    // for (const url of event.articleUrls) {
    //   const { file, name } = await captureArticle({ url, browser });
    //   if (!file || !name) {
    //     return console.error("Failed to capture article");
    //   }
    //   const path = "https://www.dailyprincetonian.com/";
    //   const sanitizedPath = path.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    //   const command = new PutObjectCommand({
    //     Bucket: bucketName,
    //     Key: `${sanitizedPath}/${name}`,
    //     Body: file,
    //   });
    //   const response = await s3Client.send(command);
    //   console.log("S3 response:", response);
    // }

    for (const url of event.instagramUrls) {
      const { file, name } = await capturePost({ url, browser });
      if (!file || !name) {
        return console.error("Failed to capture Instagram post");
      }
      const path = "https://www.instagram.com/dailyprincetonian/";
      const sanitizedPath = path.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${sanitizedPath}/${name}`,
        Body: file,
      });
      const response = await s3Client.send(command);
      console.log("S3 response:", response);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }
  return;
};

/*
exports.handler = async (event, context) => {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(process.env.AWS_EXECUTION_ENV ? '/opt/nodejs/node_modules/@sparticuz/chromium/bin' : undefined, ),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    try {
        const urlToRead = event.webUrl;
        const domain = new URL(urlToRead).host;
        const outputFilePath = `${urlToRead.split(`${domain}/`)[1]}`;
        let now = new Date();
        now.setHours(48);
        const cookies = [{
            'url': urlToRead,
            'domain': domain,
            'path': '/',
            'expires': new Date().getTime(),
            'max-age': 60 * 60 * 24 * 2
        }];
        await page.setCookie(...cookies);
        await page.goto(urlToRead, {
            timeout: 60000,
            waitUntil: ['load', 'networkidle0', 'domcontentloaded']
        });
        const html = await page.content();
        const s3Client = new S3Client({
            region: process.env.AWS_BUCKET_REGION,
            credentials: {
                accessKeyId: process.env.ACCESS_KEY,
                secretAccessKey: process.env.SECRET_KEY
            }
        });
        const bucketName = process.env.AWS_BUCKET_NAME;
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: outputFilePath,
            Body: html,
        });
        try {
            const response = await s3Client.send(command);
            console.log(response);
        } catch (err) {
            console.error(err);
        }
    } catch (error) {
        console.log(error);
    } finally {
        await page.close();
        await browser.close();
    }
    return;
};
*/
