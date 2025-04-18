import dotenv from "dotenv";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";

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