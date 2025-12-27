/**
 * DynamoDB helper functions.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file dynamoHelpers.mjs
 */

import { DynamoDBClient, GetCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
import logger from "./logger.mjs";

dotenv.config();

const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_KEY = process.env.AWS_SECRET_KEY;
const REGION = process.env.AWS_REGION;
const LOCAL = process.env.LOCAL;
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NAME;

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
 * Checks if an item is archived in DynamoDB
 * @param {Object} options
 * @param {string} options.id - The ID of the item
 * @param {string} options.source - The source of the item
 * @returns {Promise<boolean>} Whether the post is archived
 */
export const checkIfArchived = async ({ id, source }) => {
    logger.info(`Checking if ${id} is archived in ${TABLE_NAME} for source ${source}`);
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                id,
                source
            }
        });
        const result = await dynamoDocClient.send(command);
        return result.Item ? true : false;
    } catch (error) {
        logger.error(`Error checking if ${id} is archived in ${TABLE_NAME} for source ${source}: ${error}`);
        return false;
    }
};

/**
 * Marks an item as archived in DynamoDB
 * @param {Object} options - The options for the markArchived function
 * @param {string} options.id - The ID of the item
 * @param {string} options.source - The source of the item
 * @param {number} options.timestamp - The timestamp of the item
 * @param {string} options.url - The URL of the item
 * @returns {Promise<boolean>} Whether the item was marked as archived successfully
 */
export const markArchived = async ({ id, source, timestamp, url }) => {
    logger.info(`Marking ${id} as archived in ${TABLE_NAME} for source ${source}`);
    try {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                id,
                source,
                timestamp,
                url,
                archivedAt: new Date().toISOString(),
            },
        });
        await dynamoDocClient.send(command);
        return true;
    } catch (error) {
        logger.error(`Error marking ${postId} as archived in ${TABLE_NAME}: ${error}`);
        return false;
    }
};
