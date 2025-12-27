/**
 * Instagram service for the archiver.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file instagramService.mjs
 */

import { ApifyClient } from "apify-client";
import { downloadMetadataAsJSON, downloadImagesAsPDF, downloadVideo } from "../../utils/downloadHelpers.mjs";
import logger from "../../utils/logger.mjs";
import dotenv from "dotenv";
import { formatTimestamp, subtractDays } from "../../utils/dateHelpers.mjs";
import { z } from "zod";
import { s3Client, saveToS3 } from "../../utils/s3Helpers.mjs";

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const INSTAGRAM_ACCOUNT = "dailyprincetonian";
const BUCKET_FOLDER = "instagram";
const DEFAULT_LIMIT = 100;

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
    after = null,
    limit = null,
}) => {
    logger.info(`Fetching Instagram posts after ${after} with limit ${limit}`);

    let items = [];
    try {
        const client = new ApifyClient({ token: APIFY_API_TOKEN });
        const input = {
            addParentData: false,
            directUrls: [`https://www.instagram.com/${INSTAGRAM_ACCOUNT}/`],
            resultsType: "posts",
            searchType: "hashtag",
            searchLimit: 1,
            resultsLimit: DEFAULT_LIMIT,
        };
        if (after) {
            input.onlyPostsNewerThan = formatTimestamp(after);
        }
        if (limit) {
            input.resultsLimit = limit;
        }
        const run = await client.actor("apify/instagram-scraper").call(input);
        const result = await client.dataset(run.defaultDatasetId).listItems();
        items = result.items;
    } catch (error) {
        logger.error(`Error fetching Instagram posts: ${error}`);
        return [];
    }

    if (items.length === 0 || (items[0].error || items[0].errorDescription)) {
        logger.error(`Error fetching Instagram posts: ${items[0].error || items[0].errorDescription}`);
        return [];
    }

    items = items.filter((item) => {
        if (!item.type || !item.url || !item.timestamp || !item.id || (!item.images && !item.videoUrl && !item.displayUrl)) {
            logger.warn(`Invalid item: missing required fields`);
            return false;
        } else if (after && new Date(item.timestamp) < new Date(after)) {
            logger.debug(`Invalid item: is before the after date`);
            return false;
        }
        return true;
    });

    if (items.length === 0) {
        logger.warn(`No valid Instagram posts found after ${after.toISOString()}`);
        return [];
    }

    logger.info(`Found ${items.length} valid Instagram posts to process`);
    return items;
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

        let savedItems = 0;
        for (const item of items) {
            const metadata = await downloadMetadataAsJSON({ item });
            if (!metadata) {
                logger.error(`Failed to download metadata for item ${item.id}`);
                continue;
            }

            let mediaBuffer;
            let mediaExtension;

            if (item.type === "Image") {
                const pdfBuffer = await downloadImagesAsPDF({ images: [item.displayUrl] });
                if (!pdfBuffer) {
                    logger.error(`Failed to download images as PDF for item ${item.id}`);
                    continue;
                }
                mediaBuffer = pdfBuffer;
                mediaExtension = "pdf";
            }

            if (item.type === "Video") {
                const videoBuffer = await downloadVideo({ videoUrl: item.videoUrl });
                if (!videoBuffer) {
                    logger.error(`Failed to download video for item ${item.id}`);
                    continue;
                }
                mediaBuffer = videoBuffer;
                mediaExtension = "mp4";
            }

            if (item.type === "Sidecar") {
                const pdfBuffer = await downloadImagesAsPDF({ images: item.images });
                if (!pdfBuffer) {
                    logger.error(`Failed to download images as PDF for item ${item.id}`);
                    continue;
                }
                mediaBuffer = pdfBuffer;
                mediaExtension = "pdf";
            }

            if (!mediaBuffer || !mediaExtension) {
                logger.error(`No valid media found for item ${item.id}`);
                continue;
            }

            const folderName = item.id;
            const key = `${BUCKET_FOLDER}/${folderName}`;
            const metadataKey = `${key}/metadata.json`;
            const mediaKey = `${key}/media.${mediaExtension}`;

            const savedMetadata = await saveToS3({ file: metadata, key: metadataKey });
            if (!savedMetadata) {
                logger.error(`Failed to save metadata to S3: ${metadataKey}`);
                continue;
            }
            const savedMedia = await saveToS3({ file: mediaBuffer, key: mediaKey });
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

runArchiverInstagram({ after: subtractDays(new Date(), DAYS_AGO), limit: RESULTS_LIMIT });