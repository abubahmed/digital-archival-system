import dotenv from "dotenv";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";

dotenv.config();

export const formatTimestamp = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

export const beautifyTimestamp = (timestamp) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = date.getFullYear();
  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${month} ${day}, ${year} at ${hour12}:${minutes}:${seconds} ${suffix}`;
};

export const sanitizeFileName = (text, maxLength = 255) => {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, maxLength);
};

export const sanitizeText = (text) => {
  if (!text) return "";
  return String(text).trim().replace(/\0/g, ""); // Remove null bytes and trim
};


export const instantiateS3 = () => {
  const client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: process.env.LOCAL
      ? {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      }
      : undefined,
  });
  if (!client) throw new Error("Failed to instantiate S3 client");
  return client;
};

export const putToS3 = async ({ file, S3Client, bucketName, path }) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: file,
  });
  const response = await S3Client.send(command);
  if (response.$metadata.httpStatusCode !== 200) {
    throw new Error(`Failed to upload to S3: ${response.$metadata.httpStatusCode}`);
  }
};