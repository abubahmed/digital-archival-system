import { formatTimestamp, putToS3, instantiateS3 } from "../util/helper.mjs";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import TimeDatabase from "../util/manage_db.mjs";
import mailchimp from "@mailchimp/mailchimp_marketing";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

export const newsletterHandler = async ({ event, context, callback }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  const timeDatabase = new TimeDatabase("newsletter");
  const latestTime = timeDatabase.getLatestTime();
  const currentTime = new Date();
  if ((currentTime - latestTime) / (1000 * 60 * 60 * 24) < 7) {
    throw new Error("Latest time is less than 7 days old");
  }

  // Instantiate the AWS S3 client and fetch Instagram posts
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-web-security", "--allow-insecure-localhost"],
  });
  log.info("Puppeteer client instantiated");

  const { newsletters: posts, latestTime: newestLatestTime } = await fetchNewsletters({ after: latestTime });
  timeDatabase.addTime(newestLatestTime);
  log.info(`${posts.length} newsletters fetched`);

  // Iterate through each post and process it
  let processedPosts = 0;
  for (const post of posts) {
    processedPosts++;
    log.info(`Processing post ${processedPosts}/${posts.length}`);
    const { long_archive_url, create_time } = post;
    const sanitizedWebUrl = long_archive_url.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const formattedTimestamp = formatTimestamp(create_time);
    const fileName = `${sanitizedWebUrl}_${formattedTimestamp}.pdf`;

    const pdfBuffer = await captureNewsletter({
      url: long_archive_url,
      browser,
    });
    if (local) {
      const localPath = `./documents/newsletters/${fileName}`;
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, pdfBuffer);
    }
    await putToS3({
      file: pdfBuffer,
      S3Client: s3Client,
      bucketName,
      path: `newsletters/${fileName}`,
    });
  }
  browser.close();
};

export const fetchNewsletters = async ({ after = new Date(0) }) => {
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: "us7",
  });
  const response = await mailchimp.campaigns.list({
    count: 5,
    offset: 0,
    since_create_time: after,
    sort_field: "create_time",
  })
  const newsletters = response.campaigns.filter(
    (newsletter) => newsletter.long_archive_url && newsletter.create_time
      && newsletter.id && newsletter.archive_url
  );
  if (newsletters.length === 0) throw new Error("No newsletters found after the specified date");
  const latestTime = new Date(newsletters[newsletters.length - 1].create_time)
  return {
    newsletters,
    latestTime,
  }
};

const captureNewsletter = async ({ url, browser }) => {
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
  await page.evaluate(() => {
    const targetItems = document.querySelectorAll("#awesomebar");
    targetItems.forEach((item) => item.remove());
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
  return pdfBuffer;
}
