/**
 * DynamoDB helper functions.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file dynamoHelpers.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
import logger from "./logger.mjs";

dotenv.config();

const TABLE_NAME = process.env.AWS_DYNAMO_NAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_KEY = process.env.AWS_SECRET_KEY;
const REGION = process.env.AWS_REGION;
const LOCAL = process.env.LOCAL;


/**
 * The DynamoDB client
 * @type {DynamoDBClient}
 */
export const dynamoClient = new DynamoDBClient({
    region: REGION,
    credentials: LOCAL
        ? {
            accessKeyId: ACCESS_KEY,
            secretAccessKey: SECRET_KEY,
        }
        : undefined,
});
export const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Checks if a post is archived in DynamoDB
 * @param {Object} options - The options for the checkIfArchived function
 * @param {string} options.platform - The platform of the post
 * @param {string} options.postId - The ID of the post
 * @returns {Promise<boolean>} Whether the post is archived
 */
export const checkIfArchived = async ({ platform, postId }) => {
    logger.info(`Checking if ${platform} ${postId} is archived`);
    try {
        const result = await dynamoDocClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { platform, postId },
        }));
        return !!result.Item;
    } catch (error) {
        logger.error(`Error checking if ${platform} ${postId} is archived: ${error}`);
        return false;
    }
};

/**
 * Marks a post as archived in DynamoDB
 * @param {Object} options - The options for the markArchived function
 * @param {string} options.platform - The platform of the post
 * @param {string} options.postId - The ID of the post
 * @returns {Promise<boolean>} Whether the post was marked as archived successfully
 */
export const markArchived = async ({ platform, postId }) => {
    logger.info(`Marking ${platform} ${postId} as archived`);
    try {
        await dynamoDocClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                platform,
                postId,
                archivedAt: new Date().toISOString()
            },
        }));
    } catch (error) {
        logger.error(`Error marking ${platform} ${postId} as archived: ${error}`);
        return false;
    }
};
