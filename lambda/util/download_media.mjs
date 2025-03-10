import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import log from "./logger.mjs";
import { addMetadataPage } from "./misc.mjs";

export const downloadImagesAsPdf = async ({ imageUrls, path, post }) => {
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

export const downloadImagesAsPdfBuffer = async ({ imageUrls, post }) => {
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

export const downloadVideoAsBuffer = async ({ videoUrl, post }) => {
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

export const downloadVideo = async ({ videoUrl, path, post }) => {
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