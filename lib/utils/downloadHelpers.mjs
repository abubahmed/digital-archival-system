/**
 * Download helpers for the archiver.
 * 
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 * 
 * @file downloadHelpers.mjs
 */

import axios from "axios";
import { PassThrough } from "stream";
import { PDFDocument } from "pdf-lib";
import sizeOf from "image-size";
import logger from "./logger.mjs";

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
        const response = await axios.get(imageUrl, { responseType: "stream" });
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
        const response = await axios.get(videoUrl, { responseType: "stream" });
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