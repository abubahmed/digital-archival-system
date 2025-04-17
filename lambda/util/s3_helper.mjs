import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

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
