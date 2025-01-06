import { S3Client, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import {
  downloadImagesAsPdf,
  downloadImagesAsPdfBuffer,
  downloadVideoAsBuffer,
  downloadVideo,
} from "./util/download_media.mjs";
import { putToS3, formatTimestamp, fetchInstagramPosts } from "./util/misc.mjs";
import { getTimes, addTime, getLatestTime } from "./util/manage_db.mjs";
import log from "./util/logger.mjs";
dotenv.config();

export const handler = async (event, context, callback) => {
  console.log(event);
  console.log(context);

  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_KEY;
  const local = process.env.LOCAL;

  if (!bucketName || !region || (local && (!accessKeyId || !secretAccessKey))) {
    log.error("Missing environment variable(s)");
    return;
  }

  try {
    const s3Client = new S3Client({
      region: region,
      credentials: local
        ? { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey }
        : undefined,
    });
    if (!s3Client) {
      log.error("Failed to create S3 client");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to create S3 client" }),
      };
    }
    log.info("S3 client created");

    addTime();
    log.info("Archival time saved");
    const times = getTimes();
    console.log(times);

    const postsResponse = await fetchInstagramPosts();
    if (postsResponse.status === "error") {
      log.error("Failed to fetch Instagram posts");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to fetch Instagram posts" }),
      };
    }

    const posts = postsResponse.posts;
    if (posts.length === 0) {
      log.error("No Instagram posts fetched");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "No Instagram posts found" }),
      };
    }
    log.info("Instagram posts fetched");

    for (const post of posts) {
      const { images, videoUrl, type, timestamp, url, postId } = post;
      if ((!images || images.length === 0) && !videoUrl) {
        log.error("Missing image(s) or video URL");
        continue;
      } else if (!timestamp || !type || !url || !postId) {
        log.error("Missing post metadata");
        continue;
      }
      log.info("Post data:");
      log.info(post);

      const subFolder = "instagram";
      const timestampDateFormatted = formatTimestamp({ timestamp });
      const fileName = url + timestampDateFormatted;
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const S3Path = `${subFolder}/${sanitizedFileName}`;
      const localPath = `./../documents/${sanitizedFileName}`;

      if (local) {
        log.info("Downloading media locally...");
        const mediaDownloadResponse =
          type === "video"
            ? await downloadVideo({ videoUrl, path: localPath, post: post })
            : await downloadImagesAsPdf({ imageUrls: images, path: localPath, post: post });
        if (mediaDownloadResponse.status === "error") {
          log.error("Failed to download media locally, skipping post");
          continue;
        }
        log.info("Media saved locally");
      }

      log.info("Downloading media as buffer...");
      const mediaBufferResponse =
        type === "video"
          ? await downloadVideoAsBuffer({ videoUrl, post: post })
          : await downloadImagesAsPdfBuffer({ imageUrls: images, post: post });
      if (mediaBufferResponse.status === "error") {
        log.error("Failed to download media as buffer, skipping post");
        continue;
      }
      log.info("Media buffer created");

      log.info("Uploading media to S3...");
      if (type === "video") {
        const videoFileName = "video.mp4";
        const videoPath = `${S3Path}/${videoFileName}`;
        const S3VideoResponse = await putToS3({
          file: mediaBufferResponse.videoBuffer,
          S3Client: s3Client,
          bucketName,
          path: videoPath,
        });

        if (
          S3VideoResponse.status === "error" ||
          S3VideoResponse.response.$metadata.httpStatusCode != 200
        ) {
          log.error("Failed to upload video to S3, skipping post");
          continue;
        }
        log.info("Video file uploaded to S3");

        const pdfFileName = "metadata.pdf";
        const pdfPath = `${S3Path}/${pdfFileName}`;
        const S3PdfResponse = await putToS3({
          file: mediaBufferResponse.pdfBuffer,
          S3Client: s3Client,
          bucketName,
          path: pdfPath,
        });

        if (
          S3PdfResponse.status === "error" ||
          S3PdfResponse.response.$metadata.httpStatusCode != 200
        ) {
          log.error("Failed to upload metadata to S3, skipping post");
          continue;
        }
        log.info("Video metadata uploaded to S3");
      } else {
        const pdfPath = `${S3Path}.pdf`;
        const S3Response = await putToS3({
          file: mediaBufferResponse.buffer,
          S3Client: s3Client,
          bucketName,
          path: pdfPath,
        });

        if (S3Response.status === "error" || S3Response.response.$metadata.httpStatusCode != 200) {
          log.error("Failed to upload to S3, skipping post");
          continue;
        }
        log.info("PDF file uploaded to S3");
      }
    }
    log.info("All Instagram posts archived");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Instagram archival process complete" }),
    };
  } catch (error) {
    log.error("Failed to archive Instagram posts");
    log.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to archive Instagram posts" }),
    };
  }
};
