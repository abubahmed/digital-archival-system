import { ApifyClient } from "apify-client";
import log from "./logger.mjs";
import { formatTimestamp, beautifyTimestamp, sanitizeText } from "./helper.mjs";
import { PDFDocument } from "pdf-lib";
import dotenv from "dotenv";
dotenv.config();

export const getArticlesFromMonth = async ({ month, year }) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedMonth = String(month).padStart(2, "0");
    const formattedYear = String(year);
    const formattedDate = String(yesterday.getDate()).padStart(2, "0");
    const url = `https://www.dailyprincetonian.com/search.json?a=1&s=&ti=&ts_month=${formattedMonth}&ts_day=${formattedDate}&ts_year=${formattedYear}&te_month=${formattedMonth}&te_day=${formattedDate}&te_year=${formattedYear}&au=&tg=&ty=article`;
    const response = await fetch(url);
    const data = await response.json();
    return {
      status: "success",
      message: "Articles fetched",
      items: data.items,
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return {
      status: "error",
      message: error.message,
    };
  }
};

export const captureArticle = async ({ url, browser, header, footer, startingPage }) => {
  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  let page;
  try {
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
    delay(1000);

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
      status: "success",
      pdfBuffer: pdfBuffer,
      fileName: fileName,
      title: articleTitle,
      url: url,
      pages: pages,
    };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  } finally {
    await page?.close();
  }
};

export const fetchInstagramPosts = async ({ after }) => {
  try {
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
    return {
      status: "success",
      message: "Instagram posts fetched",
      posts,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      message: error.message,
    };
  }
};

export const addMetadataPage = ({ doc, post }) => {
  const fontSize = 12;
  const lineSpacing = 1.15;
  const lineGap = fontSize * lineSpacing - fontSize;
  const margin = 96;

  const formatMetadata = (label, value) => {
    const sanitizedValue = sanitizeText(value);
    return sanitizedValue && sanitizedValue.length > 0 ? `${label}: ${sanitizedValue}\n` : "";
  };
  doc.addPage({ size: [816, 1056] });
  let postText = "";
  const postTimestamp = beautifyTimestamp(formatTimestamp(post.timestamp));
  const archivedTimestamp = beautifyTimestamp(formatTimestamp(new Date()));
  postText += postTimestamp ? `Created Timestamp: ${postTimestamp}\n` : "";
  postText += archivedTimestamp ? `Archival Timestamp: ${archivedTimestamp}\n` : "";

  postText += formatMetadata("URL", post.url);
  postText += formatMetadata("Post ID", post.postId);
  postText += formatMetadata("Short Code", post.shortCode);
  postText += formatMetadata("Hashtags", post.hashtags);
  postText += formatMetadata("Mentions", post.mentions);
  postText += formatMetadata("Comments Count", post.commentsCount);
  postText += formatMetadata("Likes Count", post.likesCount);
  postText += formatMetadata("Owner Full Name", post.ownerFullName);
  postText += formatMetadata("Owner Username", post.ownerUsername);
  postText += formatMetadata("Caption", post.caption);
  postText += formatMetadata("Alt Text", post.alt);

  doc.fontSize(fontSize);
  doc.font("./fonts/arial.ttf").text(postText, margin, margin, { lineGap });
};
