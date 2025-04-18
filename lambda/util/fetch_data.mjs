import { ApifyClient } from "apify-client";
import { formatTimestamp } from "./misc_helper.mjs";
import { PDFDocument } from "pdf-lib";
import mailchimp from "@mailchimp/mailchimp_marketing";
import log from "./logger.mjs";
import dotenv from "dotenv";

dotenv.config();

export const fetchNewsletters = async ({ id = null }) => {
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: "us7",
  });
  let response;
  if (!id) {
    response = await mailchimp.campaigns.list();
  } else {
    response = await mailchimp.campaigns.get(id);
  }
  console.log(response);
};

export const getArticlesFromMonth = async ({ month, year }) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedMonth = String(month).padStart(2, "0");
  const formattedYear = String(year);
  const formattedDate = String(yesterday.getDate()).padStart(2, "0");
  const url = `https://www.dailyprincetonian.com/search.json?a=1&s=&ti=&ts_month=${formattedMonth}&ts_day=${formattedDate}&ts_year=${formattedYear}&te_month=${formattedMonth}&te_day=${formattedDate}&te_year=${formattedYear}&au=&tg=&ty=article`;
  const response = await fetch(url);
  const data = await response.json();
  return data.items;
};

export const captureArticle = async ({ url, browser, header, footer, startingPage }) => {
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
  await page.evaluate(
    (header, footer) => {
      let targetElements = "related";
      if (!header) targetElements += ", header, .promo-bar";
      if (!footer) targetElements += ", footer";
      const targetItems = document.querySelectorAll(targetElements);
      targetItems.forEach((item) => item.remove());
    },
    header,
    footer
  );
  const articleTitle = await page.evaluate(() => {
    const h1Element = document.querySelector(".article h1");
    return h1Element ? h1Element.textContent : null;
  });

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
  const iframes = await page.$$("iframe");
  const iframePromises = iframes.map(async (iframeElement) => {
    await iframeElement.contentFrame();
  });
  await Promise.all(iframePromises);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const sanitizedWebUrl = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const formattedTimestamp = formatTimestamp(new Date());
  const fileName = `${sanitizedWebUrl}_${formattedTimestamp}.pdf`;
  const pdfOptions = {
    width: "8.5in",
    height: "11in",
    displayHeaderFooter: true,
  };
  const pdfBuffer = await page.pdf(pdfOptions);
  const pdfLoaded = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfLoaded.getPageCount();
  const pages = Array.from({ length: pageCount }, (_, i) => startingPage + i);

  return {
    pdfBuffer,
    fileName,
    title: articleTitle,
    url,
    pages: pages,
  };
};

export const fetchInstagramPosts = async ({ after }) => {
  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  });
  log.info("Apify client created");
  const instagramAccount = "dailyprincetonian";
  const resultsLimit = 5;

  const date = new Date(after);
  date.setTime(date.getTime() - 2 * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const dateFormatted = `${year}-${month}-${day}`;

  const input = {
    directUrls: [`https://www.instagram.com/${instagramAccount}/`],
    resultsType: "posts",
    searchType: "hashtag",
    searchLimit: 1,
    onlyPostsNewerThan: dateFormatted,
    enhanceUserSearchWithFacebookPage: false,
    resultsLimit,
  };
  log.info("Scraping Instagram posts...");
  const run = await client.actor("apify/instagram-scraper").call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const posts = [];

  items.forEach((item) => {
    if (
      item.type &&
      item.url &&
      item.timestamp &&
      item.id &&
      ((item.images && item.images.length > 0) || item.videoUrl) &&
      new Date(item.timestamp) >= new Date(after)
    ) {
      posts.push({
        timestamp: item.timestamp,
        url: item.url || null,
        type: item.type.toLowerCase(),
        images: item.images && item.images.length > 0 ? item.images : null,
        videoUrl: item.videoUrl || null,
        postId: item.id,
        shortCode: item.shortCode || null,
        caption: item.caption || null,
        hashtags: item.hashtags ? item.hashtags.join(", ") : null,
        mentions: item.mentions ? item.mentions.join(", ") : null,
        commentsCount: item.commentsCount ?? null,
        likesCount: item.likesCount ?? null,
        alt: item.alt || null,
        ownerFullName: item.ownerFullName || null,
        ownerUsername: item.ownerUsername || null,
        ownerId: item.ownerId || null,
      });
    }
  });

  if (posts.length === 0) throw new Error("No Instagram posts found after the specified date");
  return posts;
};
