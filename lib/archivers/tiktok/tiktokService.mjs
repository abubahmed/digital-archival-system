/* 
 * TikTok service for the archiver.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file tiktokService.mjs
 */

import { z } from "zod";
import dotenv from "dotenv";
import logger from "../../utils/logger.mjs";
import { subtractDays, formatTimestamp, isValidDate } from "../../utils/dateHelpers.mjs";
import { ApifyClient } from "apify-client";
import { s3Client, saveToS3 } from "../../utils/s3Helpers.mjs";
import { downloadMetadataAsJSON, downloadImagesAsPDF, downloadVideo } from "../../utils/downloadHelpers.mjs";

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const BUCKET_FOLDER = "tiktok";
const DEFAULT_LIMIT = 100;

/**
 * Schema for a TikTok item
 * @type {z.ZodSchema<TikTokItem>}
 */
const TikTokItemSchema = z.object({
    id: z.string(),
    text: z.string().nullable(),
    textLanguage: z.string().nullable(),

    createTime: z.number(),
    createTimeISO: z.string(),
    isAd: z.boolean(),

    authorMeta: z.object({
        id: z.string(),
        name: z.string(),
        profileUrl: z.string().url(),
        nickName: z.string(),
        verified: z.boolean(),
        signature: z.string().nullable(),
        bioLink: z.string().nullable(),

        originalAvatarUrl: z.string().url(),
        avatar: z.string().url(),

        commerceUserInfo: z.object({
            commerceUser: z.boolean(),
            category: z.string().nullable(),
            categoryButton: z.boolean().nullable(),
        }),

        privateAccount: z.boolean(),
        roomId: z.string().nullable(),
        ttSeller: z.boolean(),
        followDatasetUrl: z.string().nullable(),

        following: z.number(),
        friends: z.number(),
        fans: z.number(),
        heart: z.number(),
        video: z.number(),
        digg: z.number(),
    }),

    musicMeta: z.object({
        musicName: z.string(),
        musicAuthor: z.string(),
        musicOriginal: z.boolean(),

        playUrl: z.string().url(),
        coverMediumUrl: z.string().url(),
        originalCoverMediumUrl: z.string().url(),
        musicId: z.string(),
    }),

    locationMeta: z
        .object({
            address: z.string().nullable(),
            city: z.string().nullable(),
            cityCode: z.string().nullable(),
            countryCode: z.string().nullable(),
            locationName: z.string().nullable(),
            locationId: z.string().nullable(),
        })
        .nullable()
        .optional(),

    webVideoUrl: z.string().url(),
    mediaUrls: z.array(z.string().url()),
    commentsDatasetUrl: z.string().nullable(),

    videoMeta: z.object({
        height: z.number(),
        width: z.number(),
        duration: z.number(),

        coverUrl: z.string().url(),
        originalCoverUrl: z.string().url(),

        definition: z.string(),
        format: z.string(),

        subtitleLinks: z
            .array(
                z.object({
                    language: z.string(),
                    downloadLink: z.string().url(),
                    tiktokLink: z.string().url(),
                    source: z.string(),
                    sourceUnabbreviated: z.string(),
                    version: z.string(),
                })
            )
            .optional(),

        downloadAddr: z.string().url(),
    }),

    diggCount: z.number(),
    shareCount: z.number(),
    playCount: z.number(),
    collectCount: z.number(),
    commentCount: z.number(),
    repostCount: z.number(),

    mentions: z.array(z.string()),
    detailedMentions: z.array(z.any()),

    hashtags: z.array(
        z.object({
            name: z.string(),
        })
    ),

    effectStickers: z.array(
        z.object({
            ID: z.string(),
            name: z.string(),
            stickerStats: z.object({
                useCount: z.number(),
            }),
        })
    ),

    isSlideshow: z.boolean(),
    isPinned: z.boolean(),
    isSponsored: z.boolean(),

    input: z.string(),
    fromProfileSection: z.string(),
});

/**
 * Fetches TikTok posts from Apify
 * @param {Object} options - The options for the fetch
 * @param {Date} options.before - The date to fetch posts before (defaults to current date)
 * @param {Date} options.after - The date to fetch posts after
 * @param {number} options.limit - The limit of posts to fetch
 * @returns {Promise<TikTokItem[]>} The TikTok posts
 */
export const fetchTikTokPosts = async ({
    before = null,
    after = null,
    limit = null,
}) => {
    logger.info(`Fetching TikTok posts before ${before} and after ${after} with limit ${limit}`);

    let items = [];
    try {
        const client = new ApifyClient({ token: APIFY_API_TOKEN });
        const input = {
            excludePinnedPosts: false,
            maxRepliesPerComment: 0,
            profiles: [
                "thedailyprincetonian"
            ],
            proxyCountryCode: "None",
            scrapeRelatedVideos: false,
            shouldDownloadAvatars: false,
            shouldDownloadCovers: false,
            shouldDownloadMusicCovers: false,
            shouldDownloadSlideshowImages: false,
            shouldDownloadSubtitles: false,
            shouldDownloadVideos: true,
            resultsPerPage: DEFAULT_LIMIT,
        }
        if (limit) {
            input.resultsPerPage = limit;
        }
        if (before) {
            input.newestPostDate = formatTimestamp(before);
        }
        if (after) {
            input.oldestPostDateUnified = formatTimestamp(after);
        }
        const run = await client.actor("clockworks/tiktok-scraper").call(input);
        const result = await client.dataset(run.defaultDatasetId).listItems();
        items = result.items;
    } catch (error) {
        logger.error(`Error fetching TikTok posts: ${error}`);
        return [];
    }

    if (items.length === 0 || (items[0].note === "No videos found to match the filter")) {
        logger.error(`Error fetching TikTok posts: No videos found to match the filter`);
        return [];
    }

    items = items.filter((item) => {
        if (!item.id || !item.createTimeISO || (!item.mediaUrls && !item.videoMeta?.downloadAddr)) {
            logger.warn(`Invalid item: missing required fields`);
            return false;
        } else if (after && new Date(item.createTimeISO) < new Date(after)) {
            logger.debug(`Invalid item: is before the after date`);
            return false;
        } else if (before && new Date(item.createTimeISO) > new Date(before)) {
            logger.debug(`Invalid item: is after the before date`);
            return false;
        }
        return true;
    })

    if (items.length === 0) {
        logger.warn(`No valid TikTok posts found after ${after.toISOString()}`);
        return [];
    }

    logger.info(`Found ${items.length} valid TikTok posts to process`);
    return items;
};

/**
 * Runs the archiver TikTok
 * @param {Object} options - The options for the run
 * @param {Date} options.after - The date to fetch posts after
 * @param {number} options.limit - The limit of posts to fetch
 * @returns {Promise<boolean>} Whether the archiver ran successfully
 */
export const runArchiverTikTok = async ({ after, limit }) => {
    logger.info(`Running archiver TikTok after ${after} with limit ${limit}`);
    try {
        const items = await fetchTikTokPosts({ after, limit });
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

            if (item.isSlideshow && item.mediaUrls && item.mediaUrls.length > 0) {
                const pdfBuffer = await downloadImagesAsPDF({ images: item.mediaUrls });
                if (!pdfBuffer) {
                    logger.error(`Failed to download slideshow images as PDF for item ${item.id}`);
                    continue;
                }
                mediaBuffer = pdfBuffer;
                mediaExtension = "pdf";
            }

            if (item.videoMeta?.downloadAddr) {
                const videoBuffer = await downloadVideo({ videoUrl: item.videoMeta.downloadAddr });
                if (!videoBuffer) {
                    logger.error(`Failed to download video for item ${item.id}`);
                    continue;
                }
                mediaBuffer = videoBuffer;
                mediaExtension = "mp4";
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
        logger.error(`Error running archiver TikTok: ${error}`);
        return false;
    }
};

runArchiverTikTok({});