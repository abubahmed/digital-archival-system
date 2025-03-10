import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import log from "./logger.mjs";
import dotenv from "dotenv";
dotenv.config();

export const putToS3 = async ({ file, S3Client, bucketName, path }) => {
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

export const formatTimestamp = (timestamp) => {
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
    return "";
  }
};

const beautifyTimestamp = (timestamp) => {
  try {
    const beautifiedTimestamp = new String(timestamp)
      .replace(/_/g, " ")
      .replace(
        /(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})/,
        (match, p1, p2, p3, p4, p5, p6) => {
          const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const hour = parseInt(p4);
          const suffix = hour >= 12 ? "PM" : "AM";
          const formattedTime = `${p4}:${p5}:${p6} ${suffix}`;
          return `${months[parseInt(p2) - 1]} ${p3}, ${p1} at ${formattedTime}`;
        }
      );
    return beautifiedTimestamp;
  } catch (error) {
    log.error(error);
    return "";
  }
};

export const sanitizeText = (text) => {
  try {
    let stringText = String(text);
    stringText = stringText.trim().replace(/\s+/g, " ");
    stringText = stringText.replace(/[^ -~]/g, "");
    return stringText;
  } catch (error) {
    log.error(error);
    return "";
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
      // onlyPostsNewerThan: dateFormatted,
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
      posts: [],
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
  return {
    status: "success",
    message: "Metadata page added",
  };
};
