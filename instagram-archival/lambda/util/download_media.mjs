import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import log from "./logger.mjs";
import { addMetadataPage } from "./misc.mjs";

/**
 * Downloads images and compiles them into a PDF file saved locally, including a metadata page.
 * 
 * @param {Object} options - The options for downloading images as a PDF.
 * @param {string[]} options.imageUrls - Array of image URLs to be added to the PDF.
 * @param {string} options.path - The file path where the PDF will be saved.
 * @param {Object} options.post - Metadata of the post associated with the images.
 * 
 * @returns {Object} - Status and message of the operation.
 * 
 * The function:
 * - Fetches images from the provided URLs and determines their dimensions.
 * - Creates a PDF document and adds each image as a separate page.
 * - Appends a metadata page with details from the `post` object.
 * - Saves the resulting PDF file locally at the specified `path`.
 * 
 * @example
 * await downloadImagesAsPdf({
 *   imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
 *   path: "./downloads/post123",
 *   post: { postId: "123", url: "https://example.com/post/123" }
 * });
 */
export const downloadImagesAsPdf = async ({ imageUrls, path, post }) => {
  if (!imageUrls || imageUrls.length === 0 || !path || !post) {
    log.error("Missing argument(s); cancelled local PDF download");
    return { status: "error", message: "Missing argument(s)" };
  }
  try {
    const pdfPath = path + ".pdf";
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    for (const imageUrl of imageUrls) {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data, "binary");
      const dimensions = sizeOf(imageBuffer);
      doc
        .addPage({ size: [dimensions.width, dimensions.height] })
        .image(imageBuffer, 0, 0, { width: dimensions.width, height: dimensions.height });
    }

    addMetadataPage({ doc, post })
    doc.end();
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    return { status: "success", message: "PDF created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

/**
 * Downloads images and compiles them into a PDF buffer, including a metadata page.
 * 
 * @param {Object} options - The options for downloading images as a PDF buffer.
 * @param {string[]} options.imageUrls - Array of image URLs to be added to the PDF.
 * @param {Object} options.post - Metadata of the post associated with the images.
 * 
 * @returns {Object} - Status, message, and a buffer containing the PDF data.
 * 
 * The function:
 * - Fetches images from the provided URLs and determines their dimensions.
 * - Creates a PDF document and adds each image as a separate page.
 * - Appends a metadata page with details from the `post` object.
 * - Returns both the PDF as a buffer.
 * 
 * @example
 * const pdfBuffer = await downloadImagesAsPdfBuffer({
 *   imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
 *   post: { postId: "123", url: "https://example.com/post/123" }
 * });
 */
export const downloadImagesAsPdfBuffer = async ({ imageUrls, post }) => {
  if (!imageUrls || imageUrls.length === 0 || !post) {
    log.error("Missing argument(s); cancelled PDF buffer creation");
    return { status: "error", message: "Missing argument(s)" };
  }
  try {
    const doc = new PDFDocument({ autoFirstPage: false });
    const passThrough = new PassThrough();
    const chunks = [];
    passThrough.on("data", (chunk) => chunks.push(chunk));
    doc.pipe(passThrough);

    for (const imageUrl of imageUrls) {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data, "binary");
      const dimensions = sizeOf(imageBuffer);
      doc
        .addPage({ size: [dimensions.width, dimensions.height] })
        .image(imageBuffer, 0, 0, { width: dimensions.width, height: dimensions.height });
    }

    addMetadataPage({ doc, post })
    doc.end();
    await new Promise((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    return { status: "success", buffer, message: "PDF buffer created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

/**
 * Downloads a video as a buffer and generates a metadata PDF buffer.
 * 
 * @param {Object} options - The options for downloading a video buffer.
 * @param {string} options.videoUrl - The URL of the video to be downloaded.
 * @param {Object} options.post - Metadata of the post associated with the video.
 * 
 * @returns {Object} - Status, message, and buffers containing the video and metadata PDF.
 * 
 * The function:
 * - Downloads the video from the provided URL and stores it in memory as a buffer.
 * - Generates a metadata PDF file (`metadata.pdf`) using details contained in 'post' object.
 * - Returns both the video and metadata PDF as buffers.
 * 
 * @example
 * const { videoBuffer, pdfBuffer } = await downloadVideoAsBuffer({
 *   videoUrl: "https://example.com/video.mp4",
 *   post: { postId: "123", url: "https://example.com/post/123" }
 * });
 */
export const downloadVideoAsBuffer = async ({ videoUrl, post }) => {
  if (!videoUrl) {
    log.error("Missing argument(s); cancelled video buffer creation");
    return { status: "error", message: "Missing argument(s)" };
  }
  try {
    const response = await axios({
      method: "get",
      url: videoUrl,
      responseType: "stream",
    });

    const videoPassThrough = new PassThrough();
    const videoChunks = [];
    response.data.pipe(videoPassThrough);
    videoPassThrough.on("data", (chunk) => videoChunks.push(chunk));
    await new Promise((resolve, reject) => {
      videoPassThrough.on("end", resolve);
      videoPassThrough.on("error", reject);
    });
    const videoBuffer = Buffer.concat(videoChunks);

    const doc = new PDFDocument({ autoFirstPage: false });
    const pdfPassThrough = new PassThrough();
    const pdfChunks = [];
    pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
    doc.pipe(pdfPassThrough);
    addMetadataPage({ doc, post })
    doc.end();

    await new Promise((resolve, reject) => {
      pdfPassThrough.on("end", resolve);
      pdfPassThrough.on("error", reject);
    });
    const pdfBuffer = Buffer.concat(pdfChunks);
    return { status: "success", videoBuffer, pdfBuffer, message: "Video buffer created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

/**
 * Downloads a video and saves it locally along with a metadata PDF.
 * 
 * @param {Object} options - The options for downloading a video.
 * @param {string} options.videoUrl - The URL of the video to be downloaded.
 * @param {string} options.path - The directory path where the video and PDF will be saved.
 * @param {Object} options.post - Metadata of the post associated with the video.
 * 
 * @returns {Object} - Status and message of the operation.
 * 
 * The function:
 * - Downloads the video from the provided URL and saves it as `video.mp4`.
 * - Generates a metadata PDF file (`metadata.pdf`) using details contained in 'post' object.
 * - Saves both the video and metadata PDF to the specified `path`.
 * 
 * @example
 * await downloadVideo({
 *   videoUrl: "https://example.com/video.mp4",
 *   path: "./downloads/post123",
 *   post: { postId: "123", url: "https://example.com/post/123" }
 * });
 */
export const downloadVideo = async ({ videoUrl, path, post }) => {
  if (!videoUrl || !path) {
    log.error("Missing argument(s); cancelled local video download");
    return { status: "error", message: "Missing argument(s)" };
  }

  try {
    fs.mkdirSync(path, { recursive: true });
    const videoFileName = "video.mp4";
    const videoPath = `${path}/${videoFileName}`;
    const pdfFileName = "metadata.pdf";
    const pdfPath = `${path}/${pdfFileName}`;

    const file = fs.createWriteStream(videoPath);
    const response = await axios({
      method: "get",
      url: videoUrl,
      responseType: "stream",
    });

    response.data.pipe(file);
    await new Promise((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });

    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);
    addMetadataPage({ doc, post })
    doc.end();
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return { status: "success", message: "Video downloaded" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};