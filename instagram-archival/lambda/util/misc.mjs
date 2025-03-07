import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ApifyClient } from "apify-client";
import log from "./logger.mjs";
import dotenv from "dotenv";
dotenv.config();

/**
 * Uploads a file to an Amazon S3 bucket.
 *
 * @param {Object} params - The parameter object.
 * @param {Buffer|Stream|string} params.file - The file content to upload.
 * @param {Object} params.S3Client - An instance of the AWS S3 client.
 * @param {string} params.bucketName - The name of the S3 bucket.
 * @param {string} params.path - The destination path (key) in the S3 bucket.
 * @returns {Promise<Object>} An object containing the upload status, response, and message.
 *
 * The function:
 * - Validates required parameters.
 * - Creates an S3 PutObjectCommand to upload the file.
 * - Sends the command using the provided S3 client.
 * - Returns the response or an error message.
 *
 * @example
 * putToS3({ file: buffer, S3Client, bucketName: "my-bucket", path: "uploads/file.txt" })
 * // Returns: { status: "success", message: "File uploaded to S3", response: {...} }
 */
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

/**
 * Formats a given timestamp into a readable string format.
 *
 * @param {Object} params - The parameter object.
 * @param {number|string} params.timestamp - The timestamp to format.
 * @returns {string|null} The formatted timestamp as "YYYY-MM-DD_HH-MM-SS", or null if an error occurs.
 * @example
 * formatTimestamp({ timestamp: 2025-02-03 17:01:19 });
 * // Returns: "2025-02-03_17-01-19"
 */
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

/**
 * Fetches Instagram posts from a specified account using Apify Instagram Scraper API.
 *
 * @param {Object} params - The parameter object.
 * @param {string|number} params.after - A timestamp (in milliseconds or date string) used to filter posts newer than two days before this date.
 * @returns {Promise<Object>} An object containing the fetch status, message, posts array, and post count.
 *
 * The function:
 * - Retrieves an API token from environment variables.
 * - Initializes an Apify client for scraping Instagram.
 * - Formats the `after` accordingly and subtracts 48 hours.
 * - Calls the Apify Instagram scraper to fetch posts.
 * - Filters and structures the retrieved posts.
 * - Returns the posts along with status and message.
 *
 * @example
 * fetchInstagramPosts({ after: Date.now() - 7 * 24 * 60 * 60 * 1000 })
 * // Returns: { status: "success", message: "Instagram posts fetched", posts: [...], postsCount: X }
 */
export const fetchInstagramPosts = async ({ after }) => {
  try {
    const client = new ApifyClient({
      token: APIFY_TOKEN,
    });
    log.info("Apify client created");
    const instagramAccount = "dailyprincetonian";
    const resultsLimit = 10;

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

    if (!items || items.length === 0) {
      log.error("No Instagram posts found");
      return {
        status: "error",
        message: "No Instagram posts found",
        posts: [],
        postsCount: 0,
      };
    }

    const postsCount = items.length;
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
      postsCount,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      message: error.message,
      posts: [],
      postsCount: 0,
    };
  }
};

/**
 * Sanitizes a given text input by removing unwanted characters and formatting whitespace.
 *
 * @param {string} text - The text to be sanitized.
 * @returns {string} The cleaned and formatted text.
 *
 * @example
 * sanitizeText("  Hello   World! 👋  ");
 * // Returns: "Hello World!"
 */
export const sanitizeText = (text) => {
  try {
    if (text === undefined || text === null || text === "" || String(text).length === 0) return "";
    let stringText = String(text);
    stringText = stringText.trim().replace(/\s+/g, " ");
    stringText = stringText.replace(/[^ -~]/g, "");
    return stringText;
  } catch (error) {
    log.error(error);
    return "";
  }
};

/**
 * Adds a metadata page to a PDF document.
 *
 * @param {Object} options - The input parameters.
 * @param {Object} options.doc - The PDF document instance.
 * @param {Object} options.post - The post data containing metadata.
 * @returns {Object} An object indicating the operation status and message.
 *
 * @example
 * addMetadataPage({ doc, post });
 * // Returns: { status: "success", message: "Metadata page added" }
 */
export const addMetadataPage = ({ doc, post }) => {
  if (!doc || !post) {
    log.error("Missing argument(s); cancelled metadata page creation");
    return { status: "error", message: "Missing argument(s)" };
  }

  doc.addPage({ size: [816, 1056] });
  const fontSize = 12;
  const lineSpacing = 1.15;
  const lineGap = fontSize * lineSpacing - fontSize;
  const margin = 96;

  let postText = "";
  if (post.timestamp) {
    const postTimestampDateFormatted = formatTimestamp({ timestamp: post.timestamp });
    postText += `Created Timestamp: ${postTimestampDateFormatted}\n`;
  }
  const archivalTimestampDateFormatted = formatTimestamp({ timestamp: Date.now() });
  postText += `Archival Timestamp: ${archivalTimestampDateFormatted}\n`;

  const sanitizedUrl = sanitizeText(post.url);
  if (sanitizedUrl && sanitizedUrl.length > 0) {
    postText += `URL: ${sanitizedUrl}\n`;
  }
  const sanitizedPostId = sanitizeText(post.postId);
  if (sanitizedPostId && sanitizedPostId.length > 0) {
    postText += `Post ID: ${sanitizedPostId}\n`;
  }
  const sanitizedShortCode = sanitizeText(post.shortCode);
  if (sanitizedShortCode && sanitizedShortCode.length > 0) {
    postText += `Short Code: ${sanitizedShortCode}\n`;
  }
  const sanitizedHashtags = sanitizeText(post.hashtags);
  if (sanitizedHashtags && sanitizedHashtags.length > 0) {
    postText += `Hashtags: ${sanitizedHashtags}\n`;
  }
  const sanitizedMentions = sanitizeText(post.mentions);
  if (sanitizedMentions && sanitizedMentions.length > 0) {
    postText += `Mentions: ${sanitizedMentions}\n`;
  }
  const sanitizedCommentsCount = sanitizeText(post.commentsCount);
  if (sanitizedCommentsCount && sanitizedCommentsCount.length > 0) {
    postText += `Comments Count: ${sanitizedCommentsCount}\n`;
  }
  const sanitizedLikesCount = sanitizeText(post.likesCount);
  if (sanitizedLikesCount && sanitizedLikesCount.length > 0) {
    postText += `Likes Count: ${sanitizedLikesCount}\n`;
  }
  const sanitizedOwnerFullName = sanitizeText(post.ownerFullName);
  if (sanitizedOwnerFullName && sanitizedOwnerFullName.length > 0) {
    postText += `Owner Full Name: ${sanitizedOwnerFullName}\n`;
  }
  const sanitizedOwnerUsername = sanitizeText(post.ownerUsername);
  if (sanitizedOwnerUsername && sanitizedOwnerUsername.length > 0) {
    postText += `Owner Username: ${sanitizedOwnerUsername}\n`;
  }
  const sanitizedCaption = sanitizeText(post.caption);
  if (sanitizedCaption && sanitizedCaption.length > 0) {
    postText += `Caption: ${sanitizedCaption}\n`;
  }
  const sanitizedAlt = sanitizeText(post.alt);
  if (sanitizedAlt && sanitizedAlt.length > 0) {
    postText += `Alt Text: ${sanitizedAlt}\n`;
  }

  doc.fontSize(fontSize);
  doc.font("./fonts/arial.ttf").text(postText, margin, margin, {
    lineGap: lineGap,
  });
  return {
    status: "success",
    message: "Metadata page added",
  };
};
