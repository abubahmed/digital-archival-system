import { putToS3, instantiateS3, formatTimestamp, beautifyTimestamp, sanitizeFileName } from "./../util/helper.mjs";
import { ApifyClient } from "apify-client";
import TimeDatabase from "../util/manage_db.mjs";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";

dotenv.config();

export const instagramHandler = async ({ event, context, callback }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;
  const timeDatabase = new TimeDatabase("instagram");
  const latestTime = timeDatabase.getLatestTime();
  const currentTime = new Date();
  if ((currentTime - latestTime) / (1000 * 60 * 60 * 24) < 7) {
    throw new Error("Latest time is less than 7 days old");
  }

  // Instantiate the AWS S3 client and fetch Instagram posts
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  addTime();
  const posts = await fetchInstagramPosts({ after: latestTime });
  log.info(`${posts.length} Instagram posts fetched`);

  // Iterate through each post and process it
  let processedPosts = 0;
  for (const post of posts) {
    processedPosts++;
    log.info(`Processing post ${processedPosts}/${posts.length}`);
    const { images, videoUrl, type, timestamp, url } = post;
    const fileName = `${sanitizeFileName(url)}_${formatTimestamp(timestamp)}.pdf`;
    const s3Path = `instagram/${fileName}`;
    const localPath = `./documents/${fileName}`;  

    // Download the media (images or video) if local and create a PDF buffer
    if (type === "video") {
      const mediaBufferResponse = await downloadVideoInstagram({
        videoUrl,
        videoPath: `${localPath}/video.mp4`,
        metadataPath: `${localPath}/metadata.pdf`,
        post,
        downloadLocally: local,
      });
      await putToS3({
        file: mediaBufferResponse.videoBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}/video.mp4`,
      });
      await putToS3({
        file: mediaBufferResponse.metadataBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}/metadata.pdf`,
      });
    }

    if (type === "sidecar") {
      const mediaBufferResponse = await downloadImagesInstagram({
        imageUrls: images,
        path: `${localPath}.pdf`,
        post,
        downloadLocally: local,
      });
      await putToS3({
        file: mediaBufferResponse.buffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}.pdf`,
      });
    }
  }
};

const fetchInstagramPosts = async ({ after }) => {
  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  });
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

const downloadImagesInstagram = async ({ imageUrls, path, post, downloadLocally = false }) => {
  const doc = new PDFDocument({ autoFirstPage: false });
  const pdfPassThrough = new PassThrough();
  const pdfChunks = [];
  pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
  doc.pipe(pdfPassThrough);

  for (const imageUrl of imageUrls) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data, "binary");
    const dimensions = sizeOf(imageBuffer);
    doc.addPage({ size: [dimensions.width, dimensions.height] });
    doc.image(imageBuffer, 0, 0, {
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  addMetadataPage({ doc, post });
  doc.end();
  await new Promise((resolve, reject) => {
    pdfPassThrough.on("end", resolve);
    pdfPassThrough.on("error", reject);
  });
  const pdfBuffer = Buffer.concat(pdfChunks);

  if (downloadLocally && path) {
    fs.mkdirSync(require("path").dirname(path), { recursive: true });
    fs.writeFileSync(path, pdfBuffer);
  }
  return buffer;
};

export const downloadVideoInstagram = async ({ videoUrl, videoPath, metadataPath, post, downloadLocally = false }) => {
  const response = await axios({
    method: "get",
    url: videoUrl,
    responseType: "stream",
  });
  const videoPassThrough = new PassThrough();
  const videoChunks = [];
  response.data.pipe(videoPassThrough);

  await new Promise((resolve, reject) => {
    videoPassThrough.on("data", (chunk) => videoChunks.push(chunk));
    videoPassThrough.on("end", resolve);
    videoPassThrough.on("error", reject);
  });

  const videoBuffer = Buffer.concat(videoChunks);
  const doc = new PDFDocument({ autoFirstPage: false });
  const pdfPassThrough = new PassThrough();
  const pdfChunks = [];

  pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
  doc.pipe(pdfPassThrough);
  addMetadataPage({ doc, post });
  doc.end();

  await new Promise((resolve, reject) => {
    pdfPassThrough.on("end", resolve);
    pdfPassThrough.on("error", reject);
  });
  const pdfBuffer = Buffer.concat(pdfChunks);

  if (downloadLocally && path) {
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(videoPath, videoBuffer);
    fs.writeFileSync(metadataPath, pdfBuffer);
  }
  return pdfBuffer;
};

const addMetadataPage = ({ doc, post }) => {
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
