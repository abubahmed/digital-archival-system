import axios from "axios";
import fs from "fs";
import { PassThrough } from "stream";
import PDFDocument from "pdfkit";
import sizeOf from "image-size";
import { addMetadataPage } from "./misc_helper.mjs";

export const downloadImages = async ({ imageUrls, path, post, downloadLocally = false }) => {
  const doc = new PDFDocument({ autoFirstPage: false });
  const pdfPassThrough = new PassThrough();
  const pdfChunks = [];
  pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
  doc.pipe(pdfPassThrough);

  for (const imageUrl of imageUrls) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data, "binary");
    const dimensions = sizeOf(imageBuffer);
    doc.addPage({ size: [dimensions.width, dimensions.height] });
    doc.image(imageBuffer, 0, 0, {
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  addMetadataPage({ doc, post });
  doc.end();
  await new Promise((resolve, reject) => {
    pdfPassThrough.on("end", resolve);
    pdfPassThrough.on("error", reject);
  });
  const pdfBuffer = Buffer.concat(pdfChunks);

  if (downloadLocally && path) {
    fs.mkdirSync(require("path").dirname(path), { recursive: true });
    fs.writeFileSync(path, pdfBuffer);
  }
  return buffer;
};

export const downloadVideo = async ({ videoUrl, videoPath, metadataPath, post, downloadLocally = false }) => {
  const response = await axios({
    method: "get",
    url: videoUrl,
    responseType: "stream",
  });
  const videoPassThrough = new PassThrough();
  const videoChunks = [];
  response.data.pipe(videoPassThrough);

  await new Promise((resolve, reject) => {
    videoPassThrough.on("data", (chunk) => videoChunks.push(chunk));
    videoPassThrough.on("end", resolve);
    videoPassThrough.on("error", reject);
  });

  const videoBuffer = Buffer.concat(videoChunks);
  const doc = new PDFDocument({ autoFirstPage: false });
  const pdfPassThrough = new PassThrough();
  const pdfChunks = [];

  pdfPassThrough.on("data", (chunk) => pdfChunks.push(chunk));
  doc.pipe(pdfPassThrough);
  addMetadataPage({ doc, post });
  doc.end();

  await new Promise((resolve, reject) => {
    pdfPassThrough.on("end", resolve);
    pdfPassThrough.on("error", reject);
  });
  const pdfBuffer = Buffer.concat(pdfChunks);

  if (downloadLocally && path) {
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(videoPath, videoBuffer);
    fs.writeFileSync(metadataPath, pdfBuffer);
  }
  return pdfBuffer;
};
