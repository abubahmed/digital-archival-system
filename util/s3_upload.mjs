import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

export const S3UploadFile = async ({ file, path }) => {
  if (!file || !path) {
    console.error("Missing argument(s)");
    return;
  }
  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_KEY;
  const local = process.env.LOCAL;
  if (!bucketName || !region || (local && (!accessKeyId || !secretAccessKey))) {
    console.error("Missing environment variable(s)");
    return;
  }
  try {
    let s3Client;
    if (local) {
      s3Client = new S3Client({
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });
    } else {
      s3Client = new S3Client({ region: region });
    }
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: file,
    });
    const response = await s3Client.send(command);
    console.log("S3 response:", response);
    return response;
  } catch (err) {
    console.error(err);
    return;
  }
};
