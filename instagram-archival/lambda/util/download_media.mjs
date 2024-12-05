import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import log from "./logger.mjs";

export const downloadImagesAsPdf = async ({ imageUrls, pdfPath }) => {
  if (!imageUrls || imageUrls.length === 0 || !pdfPath) {
    log.error("Missing argument(s); cancelled local PDF download");
    return { status: "error", message: "Missing argument(s)" };
  }
  try {
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

export const downloadImagesAsPdfBuffer = async ({ imageUrls }) => {
  if (!imageUrls || imageUrls.length === 0) {
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

export const downloadVideoAsBuffer = async ({ videoUrl }) => {
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
    const passThrough = new PassThrough();
    const chunks = [];
    response.data.pipe(passThrough);
    passThrough.on("data", (chunk) => chunks.push(chunk));
    await new Promise((resolve, reject) => {
      passThrough.on("end", resolve);
      passThrough.on("error", reject);
    });
    const buffer = Buffer.concat(chunks);
    return { status: "success", buffer, message: "Video buffer created" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};

export const downloadVideo = async ({ videoUrl, videoPath }) => {
  if (!videoUrl || !videoPath) {
    log.error("Missing argument(s); cancelled local video download");
    return { status: "error", message: "Missing argument(s)" };
  }
  const file = fs.createWriteStream(videoPath);
  try {
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
    return { status: "success", message: "Video downloaded" };
  } catch (error) {
    log.error(error);
    return { status: "error", message: error.message };
  }
};
