// https://medium.com/@anuragchitti1103/how-to-run-puppeteer-on-aws-lambda-using-layers-763aea8bed8
import fs from "fs";

import puppeteer from "/opt/puppeteer_layer/nodejs/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js";
import chromium from "/opt/puppeteer_layer/nodejs/node_modules/@sparticuz/chromium/build/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
console.log("Loading function");

export const handler = async (event, context, callback) => {
  console.log("Running archival tool");

  console.log(event);
  console.log(context);

  console.log("Creating browser");
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
  });
  console.log("New page");
  const page = await browser.newPage();
  try {
    const urlToRead = event.webUrl;
    const domain = new URL(urlToRead).host;
    let now = new Date();
    const outputFilePath = "test";

    now.setHours(48);
    const cookies = [
      {
        name: "max-age",
        value: `${60 * 60 * 24 * 2}`,
        url: urlToRead,
        domain: domain,
        path: "/",
        expires: new Date().getTime(),
        "max-age": 60 * 60 * 24 * 2,
      },
    ];
    await page.setCookie(...cookies);
    console.log("Going to page");
    await page.goto(urlToRead, {
      timeout: 120000,
      waitUntil: ["networkidle2", "domcontentloaded"],
    });
    console.log("Awaiting page content");
    const html = await page.content();
    const s3Client = new S3Client({
      region: process.env.AWS_BUCKET_REGION,
    });
    const bucketName = process.env.AWS_BUCKET_NAME;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: outputFilePath,
      Body: html,
    });
    try {
      console.log("Sending to S3");
      const response = await s3Client.send(command);
      console.log("S3 response:", response);
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
