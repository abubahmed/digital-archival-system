/* 
 * TikTok service for the archiver.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file tiktokService.mjs
 */

import { z } from "zod";

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
        .nullable(),

    webVideoUrl: z.string().url(),
    mediaUrls: z.array(z.string().url()).optional(),
    commentsDatasetUrl: z.string().nullable(),

    videoMeta: z.object({
        height: z.number(),
        width: z.number(),
        duration: z.number(),

        coverUrl: z.string().url(),
        originalCoverUrl: z.string().url(),

        definition: z.string(),
        format: z.string(),

        subtitleLinks: z.array(
            z.object({
                language: z.string(),
                downloadLink: z.string().url(),
                tiktokLink: z.string().url(),
                source: z.string(),
                sourceUnabbreviated: z.string(),
                version: z.string(),
            })
        ),
    }),

    diggCount: z.number(),
    shareCount: z.number(),
    playCount: z.number(),
    collectCount: z.number(),
    commentCount: z.number(),
    repostCount: z.number(),

    mentions: z.array(z.string()).optional(),
    detailedMentions: z.array(z.any()).optional(),

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
                const pdfBuffer = await downloadImagesAsPDF({ images: item.images });
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

runArchiverInstagram({ after: subtractDays(new Date(), DAYS_AGO), limit: RESULTS_LIMIT });