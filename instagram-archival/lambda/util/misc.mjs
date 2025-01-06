import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import log from "./logger.mjs";
import dotenv from "dotenv";
dotenv.config();

export const putToS3 = async ({ file, S3Client, bucketName, path }) => {
  if (!file || !S3Client || !bucketName || !path) {
    log.error("Missing argument(s); cancelled S3 upload");
    return {
      status: "error",
      response: null,
      message: "Missing argument(s)",
    };
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
      message: "File uploaded to S3",
      response,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      message: error.message,
      response: null,
    };
  }
};

export const formatTimestamp = ({ timestamp }) => {
  try {
    const timestampDate = new Date(timestamp);
    const year = timestampDate.getFullYear();
    const month = String(timestampDate.getMonth() + 1).padStart(2, "0");
    const day = String(timestampDate.getDate()).padStart(2, "0");
    const hours = String(timestampDate.getHours()).padStart(2, "0");
    const minutes = String(timestampDate.getMinutes()).padStart(2, "0");
    const seconds = String(timestampDate.getSeconds()).padStart(2, "0");
    const timestampDateFormatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    return timestampDateFormatted;
  } catch (error) {
    log.error(error);
    return null;
  }
};

export const fetchInstagramPosts = async () => {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (APIFY_TOKEN === undefined || APIFY_TOKEN === "") {
    log.error("Missing environment variable(s); cancelled Instagram scraping");
    return {
      status: "error",
      message: "Missing environment variable(s)",
      posts: [],
    };
  }

  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });
    log.info("Apify client created");
    const resultLimit = 3;
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
  
    if (!items || items.length === 0) {
      log.error("No Instagram posts found");
      return {
        status: "status",
        message: "No Instagram posts found",
        posts: [],
      };
    }

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
          shortCode: item.shortCode ? item.shortCode : null,
          caption: item.caption ? item.caption : null,
          hashtags: item.hashtags ? item.hashtags.join(", ") : null,
          mentions: item.mentions ? item.mentions.join(", ") : null,
          commentsCount: item.commentsCount || item.commentsCount === 0 ? item.commentsCount : null,
          likesCount: item.likesCount || item.likesCount === 0 ? item.likesCount : null,
          alt: item.alt ? item.alt : null,
          ownerFullName: item.ownerFullName ? item.ownerFullName : null,
          ownerUsername: item.ownerUsername ? item.ownerUsername : null,
          ownerId: item.ownerId ? item.ownerId : null,
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
      posts: [],
    };
  }
};
