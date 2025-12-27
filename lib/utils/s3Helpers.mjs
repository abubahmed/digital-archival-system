/**
 * S3 helper functions.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file s3Helpers.mjs
 */

import logger from "./logger.mjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_KEY = process.env.AWS_SECRET_KEY;
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const BUCKET_REGION = process.env.AWS_BUCKET_REGION;
const LOCAL = process.env.LOCAL;

/**
 * The S3 client
 * @type {S3Client}
 */
export const s3Client = new S3Client({
    region: BUCKET_REGION,
    credentials: LOCAL
        ? {
            accessKeyId: ACCESS_KEY,
            secretAccessKey: SECRET_KEY,
        }
        : undefined,
});

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
}) => {
    logger.info(`Saving file to S3: ${key}`);
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
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