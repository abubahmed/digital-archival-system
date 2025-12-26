import { ApifyClient } from "apify-client";
import axios from "axios"
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import logger from "../../utils/logger.mjs";
import dotenv from "dotenv";
import { formatTimestamp, subtractDays } from "./utils/dateHelpers.mjs";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const INSTAGRAM_ACCOUNT = "dailyprincetonian";
const RESULTS_LIMIT = 10;
const DAYS_AGO = 30;
const BUCKET_FOLDER = "instagram";

/**
 * Schema for an Instagram item
 * @type {z.ZodSchema<InstagramItem>}
 */
export const InstagramItemSchema = z.object({
    id: z.string(),
    type: z.enum(["Image", "Sidecar", "Video"]),
    shortCode: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    mentions: z.array(z.string()),
    url: z.string().url(),

    commentsCount: z.number(),
    firstComment: z.string(),

    latestComments: z.array(z.any()),
    childPosts: z.array(z.any()),

    dimensionsHeight: z.number(),
    dimensionsWidth: z.number(),

    displayUrl: z.string().url(),
    images: z.array(z.string()),

    alt: z.string(),
    likesCount: z.number(),

    timestamp: z.string(),

    ownerFullName: z.string(),
    ownerUsername: z.string(),
    ownerId: z.string(),

    isCommentsDisabled: z.boolean(),
    inputUrl: z.string().url(),
});

/**
 * Fetches Instagram posts from Apify
 * @param {Object} options - The options for the fetch
 * @param {Date} options.after - The date to fetch posts after
 * @param {number} options.limit - The limit of posts to fetch
 * @returns {Promise<InstagramItem[]>} The Instagram posts
 */
export const fetchInstagramPosts = async ({
    after = subtractDays(new Date(), DAYS_AGO),
    limit = RESULTS_LIMIT,
}) => {
    logger.info(`Fetching Instagram posts after ${after} with limit ${limit}`);

    let items = [];
    try {
        const client = new ApifyClient({ token: APIFY_API_TOKEN });
        const run = await client.actor("apify/instagram-scraper").call({
            addParentData: false,
            directUrls: [`https://www.instagram.com/${INSTAGRAM_ACCOUNT}/`],
            resultsType: "posts",
            searchType: "hashtag",
            searchLimit: 1,
            onlyPostsNewerThan: formatTimestamp(after),
            resultsLimit: limit,
        });
        const result = await client.dataset(run.defaultDatasetId).listItems();
        items = result.items;
        if (items.length === 0 || (items[0].error || items[0].errorDescription)) {
            logger.error(`Error fetching Instagram posts: ${items[0].error || items[0].errorDescription}`);
            return [];
        }
    } catch (error) {
        logger.error(`Error fetching Instagram posts: ${error}`);
        return [];
    }

    let validItems = [];
    for (const item of items) {
        if (!item.type || !item.url || !item.timestamp || !item.id || (!item.images && !item.videoUrl)) {
            logger.warn(`Invalid item: missing required fields`);
            continue;
        } else if (after && new Date(item.timestamp) < new Date(after)) {
            logger.debug(`Invalid item: is before the after date`);
            continue;
        }
        validItems.push(item);
    }
    if (validItems.length === 0) {
        logger.warn(`No valid Instagram posts found after ${after.toISOString()}`);
        return [];
    }

    logger.info(`Found ${validItems.length} valid Instagram posts to process`);
    return validItems;
};

/**
 * Downloads an image from a URL
 * @param {Object} options - The options for the download
 * @param {string} options.imageUrl - The URL of the image to download
 * @returns {Promise<Buffer>} The image buffer
 */
export const downloadImage = async ({
    imageUrl,
}) => {
    logger.info(`Downloading image from ${imageUrl}`);
    try {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const imagePassThrough = new PassThrough();
        const imageChunks = [];
        response.data.pipe(imagePassThrough);
        await new Promise((resolve, reject) => {
            imagePassThrough.on("data", (chunk) => imageChunks.push(chunk));
            imagePassThrough.on("end", resolve);
            imagePassThrough.on("error", reject);
        });
        const imageBuffer = Buffer.concat(imageChunks);
        return imageBuffer;
    } catch (error) {
        logger.error(`Error downloading image: ${error}`);
        return null;
    }
};

/**
 * Downloads images as a PDF
 * @param {Object} options - The options for the download
 * @param {string[]} options.images - The URLs of the images to download
 * @returns {Promise<Buffer>} The PDF buffer
 */
export const downloadImagesAsPDF = async ({ images }) => {
    logger.info(`Downloading images as PDF from ${images.length} images`);
    try {
        const doc = new PDFDocument({ autoFirstPage: false });
        const chunks = [];
        return new Promise(async (resolve, reject) => {
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            for (const image of images) {
                const imageBuffer = await downloadImage({ imageUrl: image });
                const { width, height } = sizeOf(imageBuffer);
                doc.addPage({ size: [width, height] });
                doc.image(imageBuffer, 0, 0, { width, height });
            }
            doc.end();
        });
    } catch (error) {
        logger.error(`Error downloading images as PDF: ${error}`);
        return null;
    }
};


/**
 * Downloads a video from a URL
 * @param {Object} options - The options for the download
 * @param {string} options.videoUrl - The URL of the video to download
 * @returns {Promise<Buffer>} The video buffer
 */
export const downloadVideo = async ({
    videoUrl,
}) => {
    logger.info(`Downloading video from ${videoUrl}`);
    try {
        const response = await axios.get(videoUrl, { responseType: "arraybuffer" });
        const videoPassThrough = new PassThrough();
        const videoChunks = [];
        response.data.pipe(videoPassThrough);
        await new Promise((resolve, reject) => {
            videoPassThrough.on("data", (chunk) => videoChunks.push(chunk));
            videoPassThrough.on("end", resolve);
            videoPassThrough.on("error", reject);
        });
        const videoBuffer = Buffer.concat(videoChunks);
        return videoBuffer;
    } catch (error) {
        logger.error(`Error downloading video: ${error}`);
        return null;
    }
};

/**
 * Downloads metadata as a JSON string
 * @param {Object} options - The options for the download
 * @param {Object} options.item - The item to download metadata from
 * @returns {Promise<Buffer>} The JSON buffer
 */
export const downloadMetadataAsJSON = async ({
    item,
}) => {
    logger.info(`Downloading metadata as JSON from ${item.id}`);
    try {
        return Buffer.from(JSON.stringify(item, null, 2));
    } catch (error) {
        logger.error(`Error downloading metadata as JSON: ${error}`);
        return null;
    }
};

/**
 * Generates a folder name from an item
 * @param {Object} options - The options for the generation
 * @param {Object} options.item - The item to generate the folder name from
 * @returns {string} The folder name
 */
export const generateFolderName = ({
    item,
}) => {
    return `${item.id}`;
};

/**
 * Instantiates an S3 client
 * @returns {S3Client} The S3 client
 */
export const instantiateS3 = () => {
    logger.info(`Instantiating S3 client`);
    try {
        const s3Client = new S3Client({
            region: process.env.AWS_BUCKET_REGION,
            credentials: process.env.LOCAL
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY,
                    secretAccessKey: process.env.AWS_SECRET_KEY,
                }
                : undefined,
        });
        if (!s3Client) throw new Error("Failed to instantiate S3 client");
        return s3Client;
    } catch (error) {
        logger.error(`Error instantiating S3 client: ${error}`);
        throw error;
    }
};

/**
 * Saves a file to S3
 * @param {Object} options - The options for the save
 * @param {Buffer} options.file - The file to save
 * @param {string} options.key - The key to save the file to
 * @param {S3Client} options.s3Client - The S3 client to use
 * @returns {Promise<boolean>} Whether the file was saved successfully
 */
export const saveToS3 = async ({
    file,
    key,
    s3Client
}) => {
    logger.info(`Saving file to S3: ${key}`);
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: file,
        });
        const response = await s3Client.send(command);
        if (response.$metadata.httpStatusCode !== 200) {
            logger.error(`Failed to save to S3: ${response.$metadata.httpStatusCode}`);
            return false;
        }
        logger.info(`Saved to S3: ${key}`);
        return true;
    } catch (error) {
        logger.error(`Error saving to S3: ${error}`);
        return false;
    }
};

/**
 * Runs the archiver Instagram
 * @param {Object} options - The options for the run
 * @param {Date} options.after - The date to fetch posts after
 * @param {number} options.limit - The limit of posts to fetch
 * @returns {Promise<boolean>} Whether the archiver ran successfully
 */
export const runArchiverInstagram = async ({ after, limit }) => {
    logger.info(`Running archiver Instagram after ${after} with limit ${limit}`);
    try {
        const items = await fetchInstagramPosts({ after, limit });
        if (!items || items.length === 0) {
            logger.error(`No items found after ${after} with limit ${limit}`);
            return false;
        }

        const s3Client = instantiateS3();
        if (!s3Client) {
            logger.error(`Failed to instantiate S3 client`);
            return false;
        }

        let savedItems = 0;
        for (const item of items) {
            const metadata = await downloadMetadataAsJSON({ item });
            if (!metadata) {
                logger.error(`Failed to download metadata for item ${item.id}`);
                continue;
            }

            let mediaBuffer;
            if (item.type === "Image") {
                const pdfBuffer = await downloadImagesAsPDF({ images: [item.displayUrl] });
                if (!pdfBuffer) {
                    logger.error(`Failed to download images as PDF for item ${item.id}`);
                    continue;
                }
                mediaBuffer = pdfBuffer;
            }

            if (item.type === "Video") {
                const videoBuffer = await downloadVideo({ videoUrl: item.videoUrl });
                if (!videoBuffer) {
                    logger.error(`Failed to download video for item ${item.id}`);
                    continue;
                }
                mediaBuffer = videoBuffer;
            }

            if (item.type === "Sidecar") {
                const pdfBuffer = await downloadImagesAsPDF({ images: item.displayUrl });
                if (!pdfBuffer) {
                    logger.error(`Failed to download images as PDF for item ${item.id}`);
                    continue;
                }
                mediaBuffer = pdfBuffer;
            }

            const folderName = generateFolderName({ item });
            const key = `${BUCKET_FOLDER}/${folderName}`;
            const metadataKey = `${key}/metadata.json`;
            const mediaExtension = item.type === "Video" ? "mp4" : "pdf";
            const mediaKey = `${key}/media.${mediaExtension}`;

            const savedMetadata = await saveToS3({ file: metadata, key: metadataKey, s3Client });
            if (!savedMetadata) {
                logger.error(`Failed to save metadata to S3: ${metadataKey}`);
                continue;
            }
            const savedMedia = await saveToS3({ file: mediaBuffer, key: mediaKey, s3Client });
            if (!savedMedia) {
                logger.error(`Failed to save media to S3: ${mediaKey}`);
                continue;
            }
            savedItems++;
            logger.info(`Saved item ${savedItems}/${items.length}: ${item.id}`);
        }

        logger.info(`Archived ${savedItems} items`);
        return true;
    } catch (error) {
        logger.error(`Error running archiver Instagram: ${error}`);
        return false;
    }
};