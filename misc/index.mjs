// https://medium.com/@anuragchitti1103/how-to-run-puppeteer-on-aws-lambda-using-layers-763aea8bed8
import puppeteer from "puppeteer";
/**
import puppeteer from "/opt/puppeteer_layer/nodejs/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js";
import chromium from "/opt/puppeteer_layer/nodejs/node_modules/@sparticuz/chromium/build/index.js";
*/
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
    for (const url of event.webUrls) {
      const { file, name } = await captureArticle({ url, browser });
      if (!file || !name) {
        return console.error("Failed to capture article");
      }
      const subFolder = "articles";
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${subFolder}/${name}`,
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

const captureArticle = async ({ url, browser }) => {
  if (!url || !browser) {
    console.error("Missing argument(s)");
    return { file: null, name: null };
  }
  const local = process.env.LOCAL;
  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  const page = await browser.newPage();
  try {
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
    console.log(`Setting cookies for ${url}`);
    await page.setCookie(...cookies);
    console.log(`Navigating to ${url}`);
    await page.goto(url, {
      timeout: 120000,
      waitUntil: ["networkidle2", "domcontentloaded"],
    });
    delay(1000);
    await page.addStyleTag({
      content: `
        @page {
          margin: 1in 0 1in 0;
        }
        @page :first {
          margin-top: 0.5in;
          margin-bottom: 1in;
        }
      `,
    });
    const now = new Date();
    const sanitizedWebUrl = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const currentDateTime = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    console.log(currentDateTime);
    const fileName = `${sanitizedWebUrl}_${currentDateTime}.pdf`;
    console.log(`Capturing article at ${url}`);
    const pdfOptions = {
      width: "8.5in",
      height: "11in",
      displayHeaderFooter: true,
      margin: { top: "1in", bottom: "1in" },
    };
    if (local) {
      pdfOptions.path = `documents/${fileName}`;
    }
    const pdfBuffer = await page.pdf(pdfOptions);
    console.log(`Captured article at ${url}`);
    return { file: pdfBuffer, name: fileName };
  } catch (error) {
    console.error(error);
    return { file: null, name: null };
  } finally {
    await page.close();
    console.log(`Closed page for ${url}`);
  }
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
