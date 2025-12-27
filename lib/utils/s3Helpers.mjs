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