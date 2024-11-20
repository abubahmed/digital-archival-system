import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import log from "npmlog";
import dotenv from "dotenv";
import {
  downloadImagesAsPdf,
  downloadImagesAsPdfBuffer,
  downloadVideoAsBuffer,
  downloadVideo,
} from "./util/download_media.mjs";
import { readArchivedPosts, saveArchivedPost, deleteArchivedPost } from "./util/manage_db.mjs";
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
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to create S3 client" }),
      };
    }
    log.info("S3 client created");

    const postsResponse = await fetchInstagramPosts();
    if (postsResponse.status === "error") {
      log.error("Failed to fetch Instagram posts");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to fetch Instagram posts" }),
      };
    }
    const posts = postsResponse.posts;
    if (posts.length === 0) {
      log.error("No Instagram posts fetched");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "No Instagram posts found" }),
      };
    }
    log.info("Instagram posts fetched");
    console.log();

    for (const post of posts) {
      const { images, videoUrl, type, timestamp, url, postId } = post;
      if ((!images || images.length === 0) && !videoUrl) {
        log.error("Missing image(s) or video URL");
        continue;
      } else if (!timestamp || !type || !url || !postId) {
        log.error("Missing post metadata");
        continue;
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
        try {
          log.info("Downloading images locally as PDF...");
          const pdfDownloadResponse = await downloadImagesAsPdf({
            imageUrls: images,
            pdfPath: localPath,
          });
          if (pdfDownloadResponse.status === "error") {
            throw new Error("Failed to download images as PDF; cancelled S3 upload");
          }
          log.info("Images saved as PDF locally");
          log.info("Creating PDF buffer for upload to S3...");
          const pdfBufferResponse = await downloadImagesAsPdfBuffer({ imageUrls: images });
          if (pdfBufferResponse.status === "error") {
            throw new Error("Failed to create PDF buffer; cancelled S3 upload");
          }
          log.info("PDF buffer created");
          log.info("Uploading PDF to S3...");
          const response = await putToS3({
            file: pdfBufferResponse.buffer,
            S3Client: s3Client,
            bucketName,
            path: S3Path,
          });
          if (response.status === "error" || response.response.$metadata.httpStatusCode != 200) {
            throw new Error("Failed to upload to S3");
          }
          log.info("S3 response:");
          console.log(response.response);
          log.info("Media uploaded to S3");
          log.info("Saving post to database...");
          const savePostResponse = saveArchivedPost({
            url,
            created_timestamp: timestamp,
            post_id: postId,
          });
          if (savePostResponse.status === "error") {
            throw new Error("Failed to save post to database");
          }
        } catch (error) {
          log.error(error.message);
          continue;
        }
      } else if (type === "sidecar" && !local) {
        try {
          log.info("Creating PDF buffer for upload to S3...");
          const pdfBufferResponse = await downloadImagesAsPdfBuffer({ imageUrls: images });
          if (pdfBufferResponse.status === "error") {
            throw new Error("Failed to create PDF buffer; cancelled S3 upload");
          }
          log.info("PDF buffer created");
          log.info("Uploading PDF to S3...");
          const response = await putToS3({
            file: pdfBufferResponse.buffer,
            S3Client: s3Client,
            bucketName,
            path: S3Path,
          });
          if (response.status === "error" || response.response.$metadata.httpStatusCode != 200) {
            throw new Error("Failed to upload to S3");
          }
          log.info("S3 response:");
          console.log(response.response);
          log.info("Media uploaded to S3");
          log.info("Saving post to database...");
          const savePostResponse = saveArchivedPost({
            url,
            created_timestamp: timestamp,
            post_id: postId,
          });
          if (savePostResponse.status === "error") {
            throw new Error("Failed to save post to database");
          }
        } catch (error) {
          log.error(error.message);
          continue;
        }
      } else if (type === "video" && local) {
        try {
          log.info("Downloading video locally...");
          const videoDownloadResponse = await downloadVideo({ videoUrl, videoPath: localPath });
          if (videoDownloadResponse.status === "error") {
            throw new Error("Failed to download video; cancelled S3 upload");
          }
          log.info("Video saved locally");
          log.info("Creating video buffer for upload to S3...");
          const videoBufferResponse = await downloadVideoAsBuffer({ videoUrl });
          if (videoBufferResponse.status === "error") {
            throw new Error("Failed to create video buffer; cancelled S3 upload");
          }
          log.info("Video buffer created");
          log.info("Uploading video to S3...");
          const response = await putToS3({
            file: videoBufferResponse.buffer,
            S3Client: s3Client,
            bucketName,
            path: S3Path,
          });
          if (response.status === "error" || response.response.$metadata.httpStatusCode != 200) {
            throw new Error("Failed to upload to S3");
          }
          log.info("S3 response:");
          console.log(response.response);
          log.info("Media uploaded to S3");
          log.info("Saving post to database...");
          const savePostResponse = saveArchivedPost({
            url,
            created_timestamp: timestamp,
            post_id: postId,
          });
          if (savePostResponse.status === "error") {
            throw new Error("Failed to save post to database");
          }
        } catch (error) {
          log.error(error.message);
          continue;
        }
      } else if (type === "video" && !local) {
        try {
          log.info("Creating video buffer for upload to S3...");
          const videoBufferResponse = await downloadVideoAsBuffer({ videoUrl });
          if (videoBufferResponse.status === "error") {
            throw new Error("Failed to create video buffer; cancelled S3 upload");
          }
          log.info("Video buffer created");
          log.info("Uploading video to S3...");
          const response = await putToS3({
            file: videoBufferResponse.buffer,
            S3Client: s3Client,
            bucketName,
            path: S3Path,
          });
          if (response.status === "error" || response.response.$metadata.httpStatusCode != 200) {
            throw new Error("Failed to upload to S3");
          }
          log.info("S3 response:");
          console.log(response.response);
          log.info("Media uploaded to S3");
          log.info("Saving post to database...");
          const savePostResponse = saveArchivedPost({
            url,
            created_timestamp: timestamp,
            post_id: postId,
          });
          if (savePostResponse.status === "error") {
            throw new Error("Failed to save post to database");
          }
        } catch (error) {
          log.error(error.message);
          continue;
        }
      }
    }
  } catch (error) {
    log.error("Failed to archive Instagram posts");
    log.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to archive Instagram posts" }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Instagram archival completed" }),
  };
};

const putToS3 = async ({ file, S3Client, bucketName, path }) => {
  if (!file || !S3Client || !bucketName || !path) {
    log.error("Missing argument(s); cancelled S3 upload");
    throw new Error();
  }
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: file,
    });
    const response = await S3Client.send(command);
    return {
      status: "success",
      response,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      response: null,
    };
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

const fetchInstagramPosts = async () => {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (APIFY_TOKEN === undefined || APIFY_TOKEN === "") {
    log.error("Missing environment variable(s); cancelled Instagram scraping");
    throw new Error();
  }
  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });
    log.info("Apify client created");
    const resultLimit = 4;
    const instagramAccount = "dailyprincetonian";
    const input = {
      directUrls: [`https://www.instagram.com/${instagramAccount}/`],
      resultsType: "posts",
      resultsLimit: resultLimit,
      searchType: "hashtag",
      searchLimit: 1,
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
        ((item.images && item.images.length > 0) || item.videoUrl)
      ) {
        posts.push({
          timestamp: item.timestamp,
          url: item.url ? item.url : null,
          type: item.type.toLowerCase(),
          images: item.images && item.images.length > 0 ? item.images : null,
          videoUrl: item.videoUrl ? item.videoUrl : null,
          postId: item.id,
        });
      }
    });
    return {
      status: "success",
      posts,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      posts: [],
    };
  }
};
