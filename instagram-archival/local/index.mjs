// https://medium.com/@anuragchitti1103/how-to-run-puppeteer-on-aws-lambda-using-layers-763aea8bed8
/**
import puppeteer from "/opt/puppeteer_layer/nodejs/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js";
import chromium from "/opt/puppeteer_layer/nodejs/node_modules/@sparticuz/chromium/build/index.js";
*/
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import { joinImages } from "join-images";
import client from "https";
import fs from "fs";
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
    const posts = await fetchInstagramPosts({ webUrls: event.webUrls });
    posts.forEach(async (post) => {
      const { images, videoUrl, type } = post;
      if (type === "sidecar") {
        await mergeImages({ imageUrls: images });
      }
    });

    // const PATH = "https://www.instagram.com/dailyprincetonian/";
    // const sanitizedPath = PATH.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    // const command = new PutObjectCommand({
    //   Bucket: bucketName,
    //   Key: `${sanitizedPath}/${name}`,
    //   Body: file,
    // });
    // const response = await s3Client.send(command);
    // console.log("S3 response:", response);
  } catch (error) {
    console.error(error);
  }
  return;
};

const downloadImage = async (url, filepath) => {
  try {
    return new Promise((resolve, reject) => {
      client.get(url, (res) => {
        if (res.statusCode === 200) {
          res
            .pipe(fs.createWriteStream(filepath))
            .on("error", reject)
            .once("close", () => resolve(filepath));
        } else {
          res.resume();
          reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
        }
      });
    });
  } catch (error) {
    console.error(error);
    return null;
  }
};

const mergeImages = async ({ imageUrls }) => {
  if (!imageUrls || imageUrls.length === 0) {
    console.error("Missing imageUrls in input");
    return;
  }
  try {
    const imageDests = [];
    for (const imageUrl of imageUrls) {
      const sanitizedPath = `${imageUrl.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`;
      imageDests.push(sanitizedPath);
      await downloadImage(imageUrl, sanitizedPath);
    }
    const img = await joinImages(imageDests);
    await img.toFile("out.jpg");
  } catch (error) {
    console.error(error);
  }
};

const fetchInstagramPosts = async ({ webUrls }) => {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (APIFY_TOKEN === undefined || APIFY_TOKEN === "") {
    console.error("Missing APIFY_TOKEN in environment");
    return [];
  }
  if (!webUrls || webUrls.length === 0) {
    console.error("Missing webUrls in input");
    return [];
  }
  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });
    const input = {
      addParentData: false,
      directUrls: webUrls,
      enhanceUserSearchWithFacebookPage: false,
      isUserReelFeedURL: false,
      isUserTaggedFeedURL: false,
      resultsLimit: 2,
      resultsType: "posts",
      searchLimit: 1,
      searchType: "hashtag",
    };
    const run = await client.actor("apify/instagram-scraper").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const posts = [];
    items.forEach((item) => {
      if (
        item.type &&
        item.url &&
        item.timestamp &&
        item.shortCode &&
        ((item.images && item.images.length > 0) || item.videoUrl)
      ) {
        posts.push({
          timestamp: item.timestamp,
          url: item.url ? item.url : null,
          type: item.type.toLowerCase(),
          images: item.images && item.images.length > 0 ? item.images : null,
          videoUrl: item.videoUrl ? item.videoUrl : null,
          shortCode: item.shortCode,
        });
      }
    });
    return posts;
  } catch (error) {
    console.error(error);
    return [];
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
