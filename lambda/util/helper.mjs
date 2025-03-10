import { PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

export const putToS3 = async ({ file, S3Client, bucketName, path }) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: file,
    });
    const response = await S3Client.send(command);
    return {
      status: "success",
      message: "File uploaded to S3",
      response,
    };
  } catch (error) {
    log.error(error);
    return {
      status: "error",
      message: error.message,
      response: null,
    };
  }
};

export const formatTimestamp = (timestamp) => {
  try {
    const timestampDate = new Date(timestamp);
    const year = timestampDate.getFullYear();
    const month = String(timestampDate.getMonth() + 1).padStart(2, "0");
    const day = String(timestampDate.getDate()).padStart(2, "0");
    const hours = String(timestampDate.getHours()).padStart(2, "0");
    const minutes = String(timestampDate.getMinutes()).padStart(2, "0");
    const seconds = String(timestampDate.getSeconds()).padStart(2, "0");
    const timestampDateFormatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    return timestampDateFormatted;
  } catch (error) {
    log.error(error);
    return "";
  }
};

export const beautifyTimestamp = (timestamp) => {
  try {
    const beautifiedTimestamp = new String(timestamp)
      .replace(/_/g, " ")
      .replace(
        /(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})/,
        (match, p1, p2, p3, p4, p5, p6) => {
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
        }
      );
    return beautifiedTimestamp;
  } catch (error) {
    log.error(error);
    return "";
  }
};

export const sanitizeText = (text) => {
  try {
    let stringText = String(text);
    stringText = stringText.trim().replace(/\s+/g, " ");
    stringText = stringText.replace(/[^ -~]/g, "");
    return stringText;
  } catch (error) {
    log.error(error);
    return "";
  }
};