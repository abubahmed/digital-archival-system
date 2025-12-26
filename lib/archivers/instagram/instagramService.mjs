import { ApifyClient } from "apify-client";
import axios from "axios";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const INSTAGRAM_ACCOUNT = "dailyprincetonian";
const RESULTS_LIMIT = 5;
const DAYS_TO_SUBTRACT = 2;
const RESULTS_TYPE = "posts";

/**
 * Formats a timestamp to a YYYY-MM-DD string
 * @param {Date|string} timestamp - The timestamp to format
 * @returns {string} The formatted timestamp
 */
const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/**
 * Subtracts a number of days from a date
 * @param {Date|string} date - The date to subtract from
 * @param {number} days - The number of days to subtract
 * @returns {Date} The new date
 */
const subtractDays = (date, days) => {
    const newDate = new Date(date);
    newDate.setTime(newDate.getTime() - days * 24 * 60 * 60 * 1000);
    return newDate;
};

/**
 * Fetches Instagram posts from Apify after a specified date
 * @param {Object} options
 * @param {Date|string} options.after - Date to fetch posts after
 * @returns {Promise<Array>} Array of Instagram posts
 */
export const fetchInstagramPosts = async ({
    after,
}) => {
    const client = new ApifyClient({ token: APIFY_TOKEN });

    const date = subtractDays(after, DAYS_TO_SUBTRACT);
    const dateFormatted = formatTimestamp(date);

    const input = {
        directUrls: [`https://www.instagram.com/${INSTAGRAM_ACCOUNT}/`],
        resultsType: RESULTS_TYPE,
        searchType: "hashtag",
        searchLimit: 1,
        onlyPostsNewerThan: dateFormatted,
        enhanceUserSearchWithFacebookPage: false,
        resultsLimit: RESULTS_LIMIT,
    };
    const run = await client.actor("apify/instagram-scraper").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const posts = [];

    items.forEach((item) => {
        if (!item.type || !item.url || !item.timestamp || !item.id) {
            
        }


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

    if (posts.length === 0) {
        throw new Error("No Instagram posts found after the specified date");
    }
    return posts;
};

/**
 * Downloads images and creates a PDF buffer
 * @param {Object} options
 * @param {Array<string>} options.imageUrls - Array of image URLs
 * @param {Object} options.post - Post metadata object
 * @param {boolean} options.downloadLocally - Whether to write to disk
 * @param {string} options.path - Local file path (if downloadLocally is true)
 * @param {string} options.fontPath - Path to font file for PDF metadata page
 * @param {Function} options.formatTimestamp - Function to format timestamps
 * @param {Function} options.beautifyTimestamp - Function to beautify timestamps
 * @param {Function} options.sanitizeText - Function to sanitize text
 * @returns {Promise<Object>} Object with buffer property containing PDF buffer
 */
export const downloadImagesInstagram = async ({
    imageUrls,
    post,
    downloadLocally = false,
    path,
    fontPath,
    formatTimestamp,
    beautifyTimestamp,
    sanitizeText
}) => {
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

    addMetadataPage({ doc, post, fontPath, formatTimestamp, beautifyTimestamp, sanitizeText });
    doc.end();
    await new Promise((resolve, reject) => {
        pdfPassThrough.on("end", resolve);
        pdfPassThrough.on("error", reject);
    });
    const pdfBuffer = Buffer.concat(pdfChunks);

    if (downloadLocally && path) {
        const fs = await import("fs");
        const pathModule = await import("path");
        fs.mkdirSync(pathModule.dirname(path), { recursive: true });
        fs.writeFileSync(path, pdfBuffer);
    }
    return { buffer: pdfBuffer };
};

/**
 * Downloads video and creates metadata PDF buffer
 * @param {Object} options
 * @param {string} options.videoUrl - URL of the video
 * @param {string} options.videoPath - Local path for video (if downloadLocally is true)
 * @param {string} options.metadataPath - Local path for metadata PDF (if downloadLocally is true)
 * @param {Object} options.post - Post metadata object
 * @param {boolean} options.downloadLocally - Whether to write to disk
 * @param {string} options.fontPath - Path to font file for PDF metadata page
 * @param {Function} options.formatTimestamp - Function to format timestamps
 * @param {Function} options.beautifyTimestamp - Function to beautify timestamps
 * @param {Function} options.sanitizeText - Function to sanitize text
 * @returns {Promise<Object>} Object with videoBuffer and metadataBuffer properties
 */
export const downloadVideoInstagram = async ({
    videoUrl,
    videoPath,
    metadataPath,
    post,
    downloadLocally = false,
    fontPath,
    formatTimestamp,
    beautifyTimestamp,
    sanitizeText
}) => {
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
    addMetadataPage({ doc, post, fontPath, formatTimestamp, beautifyTimestamp, sanitizeText });
    doc.end();

    await new Promise((resolve, reject) => {
        pdfPassThrough.on("end", resolve);
        pdfPassThrough.on("error", reject);
    });
    const pdfBuffer = Buffer.concat(pdfChunks);

    if (downloadLocally && videoPath && metadataPath) {
        const fs = await import("fs");
        const pathModule = await import("path");
        fs.mkdirSync(pathModule.dirname(videoPath), { recursive: true });
        fs.writeFileSync(videoPath, videoBuffer);
        fs.writeFileSync(metadataPath, pdfBuffer);
    }
    return { videoBuffer, metadataBuffer: pdfBuffer };
};

/**
 * Adds a metadata page to a PDF document
 * @param {Object} options
 * @param {PDFDocument} options.doc - PDFKit document instance
 * @param {Object} options.post - Post metadata object
 * @param {string} options.fontPath - Path to font file
 * @param {Function} options.formatTimestamp - Function to format timestamps
 * @param {Function} options.beautifyTimestamp - Function to beautify timestamps
 * @param {Function} options.sanitizeText - Function to sanitize text
 */
const addMetadataPage = ({ doc, post, fontPath, formatTimestamp, beautifyTimestamp, sanitizeText }) => {
    const fontSize = 12;
    const lineSpacing = 1.15;
    const lineGap = fontSize * lineSpacing - fontSize;
    const margin = 96;

    const formatMetadata = (label, value) => {
        const sanitizedValue = sanitizeText ? sanitizeText(value) : String(value || "").trim();
        return sanitizedValue && sanitizedValue.length > 0 ? `${label}: ${sanitizedValue}\n` : "";
    };

    doc.addPage({ size: [816, 1056] });
    let postText = "";
    const postTimestamp = beautifyTimestamp ? beautifyTimestamp(formatTimestamp(post.timestamp)) : formatTimestamp(post.timestamp);
    const archivedTimestamp = beautifyTimestamp ? beautifyTimestamp(formatTimestamp(new Date())) : formatTimestamp(new Date());
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
    if (fontPath) {
        doc.font(fontPath).text(postText, margin, margin, { lineGap });
    } else {
        doc.text(postText, margin, margin, { lineGap });
    }
};

