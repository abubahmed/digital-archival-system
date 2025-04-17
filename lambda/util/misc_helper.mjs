import { PDFDocument } from "pdf-lib";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export const formatTimestamp = (timestamp) => {
  const timestampDate = new Date(timestamp);
  const year = timestampDate.getFullYear();
  const month = String(timestampDate.getMonth() + 1).padStart(2, "0");
  const day = String(timestampDate.getDate()).padStart(2, "0");
  const hours = String(timestampDate.getHours()).padStart(2, "0");
  const minutes = String(timestampDate.getMinutes()).padStart(2, "0");
  const seconds = String(timestampDate.getSeconds()).padStart(2, "0");
  const timestampDateFormatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return timestampDateFormatted;
};

export const beautifyTimestamp = (timestamp) => {
  const beautifiedTimestamp = new String(timestamp)
    .replace(/_/g, " ")
    .replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})/, (match, p1, p2, p3, p4, p5, p6) => {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const hour = parseInt(p4);
      const suffix = hour >= 12 ? "PM" : "AM";
      const formattedTime = `${p4}:${p5}:${p6} ${suffix}`;
      return `${months[parseInt(p2) - 1]} ${p3}, ${p1} at ${formattedTime}`;
    });
  return beautifiedTimestamp;
};

export const sanitizeText = (text) => {
  let stringText = String(text);
  stringText = stringText.trim().replace(/\s+/g, " ");
  stringText = stringText.replace(/[^ -~]/g, "");
  return stringText;
};

export const mergePDFBuffers = async ({ buffers, dir }) => {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedPdfBytes = await mergedPdf.save();
  const path = `./documents/${dir}/`;
  fs.mkdirSync(path, { recursive: true });
  fs.writeFileSync(`./documents/${dir}/${dir}.pdf`, mergedPdfBytes);
  return mergedPdfBytes;
};

export const addMetadataPage = ({ doc, post }) => {
  const fontSize = 12;
  const lineSpacing = 1.15;
  const lineGap = fontSize * lineSpacing - fontSize;
  const margin = 96;

  const formatMetadata = (label, value) => {
    const sanitizedValue = sanitizeText(value);
    return sanitizedValue && sanitizedValue.length > 0 ? `${label}: ${sanitizedValue}\n` : "";
  };
  doc.addPage({ size: [816, 1056] });
  let postText = "";
  const postTimestamp = beautifyTimestamp(formatTimestamp(post.timestamp));
  const archivedTimestamp = beautifyTimestamp(formatTimestamp(new Date()));
  postText += postTimestamp ? `Created Timestamp: ${postTimestamp}\n` : "";
  postText += archivedTimestamp ? `Archival Timestamp: ${archivedTimestamp}\n` : "";

  postText += formatMetadata("URL", post.url);
  postText += formatMetadata("Post ID", post.postId);
  postText += formatMetadata("Short Code", post.shortCode);
  postText += formatMetadata("Hashtags", post.hashtags);
  postText += formatMetadata("Mentions", post.mentions);
  postText += formatMetadata("Comments Count", post.commentsCount);
  postText += formatMetadata("Likes Count", post.likesCount);
  postText += formatMetadata("Owner Full Name", post.ownerFullName);
  postText += formatMetadata("Owner Username", post.ownerUsername);
  postText += formatMetadata("Caption", post.caption);
  postText += formatMetadata("Alt Text", post.alt);

  doc.fontSize(fontSize);
  doc.font("./fonts/arial.ttf").text(postText, margin, margin, { lineGap });
};
