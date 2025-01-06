import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import log from "./logger.mjs";
import { formatTimestamp } from "./misc.mjs";

export const downloadImagesAsPdf = async ({ imageUrls, path, post }) => {
  if (!imageUrls || imageUrls.length === 0 || !path || !post) {
    log.error("Missing argument(s); cancelled local PDF download");
    return { status: "error", message: "Missing argument(s)" };
  }

  try {
    const pdfPath = path + ".pdf";
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
    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    return { status: "success", message: "PDF created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

export const downloadImagesAsPdfBuffer = async ({ imageUrls, post }) => {
  if (!imageUrls || imageUrls.length === 0 || !post) {
    log.error("Missing argument(s); cancelled PDF buffer creation");
    return { status: "error", message: "Missing argument(s)" };
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
    doc.end();

    await new Promise((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    return { status: "success", buffer, message: "PDF buffer created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

export const downloadVideoAsBuffer = async ({ videoUrl, post }) => {
  if (!videoUrl) {
    log.error("Missing argument(s); cancelled video buffer creation");
    return { status: "error", message: "Missing argument(s)" };
  }

  try {
    const response = await axios({
      method: "get",
      url: videoUrl,
      responseType: "stream",
    });

    const videoPassThrough = new PassThrough();
    const videoChunks = [];
    response.data.pipe(videoPassThrough);
    videoPassThrough.on("data", (chunk) => videoChunks.push(chunk));
    await new Promise((resolve, reject) => {
      videoPassThrough.on("end", resolve);
      videoPassThrough.on("error", reject);
    });
    const videoBuffer = Buffer.concat(videoChunks);

    const doc = new PDFDocument({ autoFirstPage: false });
    const pdfPassThrough = new PassThrough();
    const pdfChunks = [];
    pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
    doc.pipe(pdfPassThrough);

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
    doc.end();

    await new Promise((resolve, reject) => {
      pdfPassThrough.on("end", resolve);
      pdfPassThrough.on("error", reject);
    });
    const pdfBuffer = Buffer.concat(pdfChunks);
    
    return { status: "success", videoBuffer, pdfBuffer, message: "Video buffer created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

export const downloadVideo = async ({ videoUrl, path, post }) => {
  if (!videoUrl || !path) {
    log.error("Missing argument(s); cancelled local video download");
    return { status: "error", message: "Missing argument(s)" };
  }

  try {
    fs.mkdirSync(path, { recursive: true });
    const videoFileName = "video.mp4";
    const videoPath = `${path}/${videoFileName}`;
    const pdfFileName = "metadata.pdf";
    const pdfPath = `${path}/${pdfFileName}`;

    const file = fs.createWriteStream(videoPath);
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

    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

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
    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return { status: "success", message: "Video downloaded" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

const sanitizeText = (text) => {
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
