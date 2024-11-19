import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import { PassThrough } from "stream";
import log from "npmlog";
import fs from "fs";
import axios from "axios";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context, callback) => {
  if (!event.webUrls || event.webUrls.length === 0) {
    log.error("Missing webUrls in input; cancelled archival");
    return;
  }
  console.log(event);
  console.log(context);

  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_KEY;
  const local = process.env.LOCAL;
  if (!bucketName || !region || (local && (!accessKeyId || !secretAccessKey))) {
    log.error("Missing environment variable(s)");
    return;
  }

  try {
    const s3Client = new S3Client({
      region: region,
      credentials: local
        ? { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey }
        : undefined,
    });
    if (!s3Client) {
      log.error("Failed to create S3 client");
      return;
    }
    log.info("S3 client created");

    const posts = await fetchInstagramPosts({ webUrls: event.webUrls });
    if (!posts || posts.length === 0) {
      return log.error("Failed to fetch Instagram posts");
    }
    log.info("Instagram posts fetched");
    console.log();

    for (const post of posts) {
      const { images, videoUrl, type, timestamp, url } = post;
      if ((!images || images.length === 0) && !videoUrl) {
        log.error("Missing image(s) or video URL");
      } else if (!timestamp || !type || !url) {
        log.error("Missing post metadata");
      }
      log.info("Post data:");
      console.log(post);

      const subFolder = "instagram";
      const timestampDateFormatted = formatTimestamp({ timestamp });
      const fileName = url + timestampDateFormatted;
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const fileExtension = type === "video" ? "mp4" : "pdf";
      const S3Path = `${subFolder}/${sanitizedFileName}.${fileExtension}`;
      const localPath = `./../documents/${sanitizedFileName}.${fileExtension}`;

      if (type === "sidecar" && local) {
        log.info("Downloading images locally as PDF...");
        await downloadImagesAsPdf({ imageUrls: images, pdfPath: localPath });
        log.info("Images saved as PDF locally");
        log.info("Creating PDF buffer for upload to S3...");
        const pdfBuffer = await downloadImagesAsPdfBuffer({ imageUrls: images });
        if (pdfBuffer) {
          log.info("PDF buffer created");
          log.info("Uploading PDF to S3...");
          await putToS3({ file: pdfBuffer, S3Client: s3Client, bucketName, path: S3Path });
          log.info("PDF uploaded to S3");
        } else {
          log.error("Failed to create PDF buffer; cancelled S3 upload");
        }
      } else if (type === "sidecar" && !local) {
        log.info("Creating PDF buffer for upload to S3...");
        const pdfBuffer = await downloadImagesAsPdfBuffer({ imageUrls: images });
        if (pdfBuffer) {
          log.info("PDF buffer created");
          log.info("Uploading PDF to S3...");
          await putToS3({ file: pdfBuffer, S3Client: s3Client, bucketName, path: S3Path });
          log.info("PDF uploaded to S3");
        } else {
          log.error("Failed to create PDF buffer; cancelled S3 upload");
        }
      } else if (type === "video" && local) {
        log.info("Downloading video locally...");
        await downloadVideo({ videoUrl, videoPath: localPath });
        log.info("Video saved locally");
        log.info("Creating video buffer for upload to S3...");
        const videoBuffer = await downloadVideoAsBuffer({ videoUrl });
        if (videoBuffer) {
          log.info("Video buffer created");
          log.info("Uploading video to S3...");
          await putToS3({ file: videoBuffer, S3Client: s3Client, bucketName, path: S3Path });
          log.info("Video uploaded to S3");
        } else {
          log.error("Failed to create video buffer; cancelled S3 upload");
        }
      } else if (type === "video" && !local) {
        log.info("Creating video buffer for upload to S3...");
        const videoBuffer = await downloadVideoAsBuffer({ videoUrl });
        if (videoBuffer) {
          log.info("Video buffer created");
          log.info("Uploading video to S3...");
          await putToS3({ file: videoBuffer, S3Client: s3Client, bucketName, path: S3Path });
          log.info("Video uploaded to S3");
        } else {
          log.error("Failed to create video buffer; cancelled S3 upload");
        }
      } else {
        return log.error("Invalid post type; cancelled archival");
      }
    }
  } catch (error) {
    log.error("Failed to archive Instagram posts");
    log.error(error);
  } finally {
    console.log();
  }
  return;
};

const putToS3 = async ({ file, S3Client, bucketName, path }) => {
  if (!file || !S3Client || !bucketName || !path) {
    log.error("Missing argument(s); cancelled S3 upload");
    return;
  }
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: file,
    });
    const response = await S3Client.send(command);
    log.info("S3 response:");
    console.log(response);
    log.info("S3 path:", path);
  } catch (error) {
    log.error(error);
  }
};

const formatTimestamp = ({ timestamp }) => {
  const timestampDate = new Date(timestamp);
  const year = timestampDate.getFullYear();
  const month = String(timestampDate.getMonth() + 1).padStart(2, "0");
  const day = String(timestampDate.getDate()).padStart(2, "0");
  const hours = String(timestampDate.getHours()).padStart(2, "0");
  const minutes = String(timestampDate.getMinutes()).padStart(2, "0");
  const seconds = String(timestampDate.getSeconds()).padStart(2, "0");
  const timestampDateFormatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return timestampDateFormatted;
};

const downloadImagesAsPdf = async ({ imageUrls, pdfPath }) => {
  if (!imageUrls || imageUrls.length === 0 || !pdfPath) {
    log.error("Missing argument(s); cancelled local PDF download");
    return;
  }
  try {
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);
    for (const imageUrl of imageUrls) {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data, "binary");
      const dimensions = sizeOf(imageBuffer);
      doc
        .addPage({ size: [dimensions.width, dimensions.height] })
        .image(imageBuffer, 0, 0, { width: dimensions.width, height: dimensions.height });
    }
    doc.end();
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  } catch (error) {
    log.error(error);
  }
};

const downloadImagesAsPdfBuffer = async ({ imageUrls }) => {
  if (!imageUrls || imageUrls.length === 0) {
    log.error("Missing argument(s); cancelled PDF buffer creation");
    return;
  }
  try {
    const doc = new PDFDocument({ autoFirstPage: false });
    const passThrough = new PassThrough();
    const chunks = [];
    passThrough.on("data", (chunk) => chunks.push(chunk));
    doc.pipe(passThrough);
    for (const imageUrl of imageUrls) {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data, "binary");
      const dimensions = sizeOf(imageBuffer);
      doc
        .addPage({ size: [dimensions.width, dimensions.height] })
        .image(imageBuffer, 0, 0, { width: dimensions.width, height: dimensions.height });
    }
    doc.end();
    await new Promise((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    return buffer;
  } catch (error) {
    log.error(error);
    return null;
  }
};

const downloadVideoAsBuffer = async ({ videoUrl }) => {
  if (!videoUrl) {
    log.error("Missing argument(s); cancelled video buffer creation");
    return null;
  }
  try {
    const response = await axios({
      method: "get",
      url: videoUrl,
      responseType: "stream",
    });
    const passThrough = new PassThrough();
    const chunks = [];
    response.data.pipe(passThrough);
    passThrough.on("data", (chunk) => chunks.push(chunk));
    await new Promise((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    return buffer;
  } catch (error) {
    log.error(error);
    return null;
  }
};

const downloadVideo = async ({ videoUrl, videoPath }) => {
  if (!videoUrl || !videoPath) {
    log.error("Missing argument(s); cancelled local video download");
    return;
  }
  const file = fs.createWriteStream(videoPath);
  try {
    const response = await axios({
      method: "get",
      url: videoUrl,
      responseType: "stream",
    });
    response.data.pipe(file);
    await new Promise((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });
  } catch (error) {
    log.error(error);
  }
};

const fetchInstagramPosts = async ({ webUrls }) => {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (APIFY_TOKEN === undefined || APIFY_TOKEN === "") {
    log.error("Missing environment variable(s); cancelled Instagram scraping");
    return [];
  }
  if (!webUrls || webUrls.length === 0) {
    log.error("Missing webUrls in input; cancelled Instagram scraping");
    return [];
  }
  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });
    log.info("Apify client created");
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
    log.info("Scraping Instagram posts...");
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
    log.error(error);
    return [];
  }
};
