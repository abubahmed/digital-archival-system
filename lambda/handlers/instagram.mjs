import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import {
  downloadImagesAsPdf,
  downloadImagesAsPdfBuffer,
  downloadVideoAsBuffer,
  downloadVideo,
} from "../util/download_media.mjs";
import { putToS3, formatTimestamp, fetchInstagramPosts } from "../util/misc.mjs";
import { addTime, getLatestTime } from "../util/manage_db.mjs";
import log from "../util/logger.mjs";
dotenv.config();

export const instagramHandler = async () => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  // Instantiate the AWS S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: local
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_KEY,
        }
      : undefined,
  });
  log.info("AWS S3 client instantiated");

  // Retrieve the last time the archival process was run from the database
  const latestTimeResponse = getLatestTime();
  if (latestTimeResponse.status === "error") {
    log.error("Failed to get latest archival time");
    return {
      status: "error",
      message: "Failed to get latest archival time",
    };
  }
  const latestTimeISO = latestTimeResponse.time;
  const addTimeResponse = addTime();
  if (addTimeResponse.status === "error") {
    log.error("Failed to add new archival time");
    return {
      status: "error",
      message: "Failed to add new archival time",
    };
  }

  // Fetch all Instagram posts posted after the most recent archival time
  const { status, posts } = await fetchInstagramPosts({ after: latestTimeISO });
  if (status === "error") {
    log.error("Failed to fetch Instagram posts");
    return {
      status: "error",
      message: "Failed to fetch Instagram posts",
    };
  }
  if (posts.length === 0) return;
  log.info(`${posts.length} Instagram posts fetched`);

  // Iterate through each post and process it
  let processedPosts = 0;
  for (const post of posts) {
    processedPosts++;
    log.info(`Processing post ${processedPosts}/${posts.length}`);
    const { images, videoUrl, type, timestamp, url, postId } = post;
    if (((!images || images.length === 0) && !videoUrl) || !timestamp || !type || !url || !postId) {
      log.error("Missing required data (image(s), video URL, or post metadata)");
      continue;
    }

    // Define the S3 path and local path for storing the resultant media
    const fileName = url + formatTimestamp(timestamp);
    const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const S3Path = `instagram/${sanitizedFileName}`;
    const localPath = `./../documents/${sanitizedFileName}`;

    // If process is running locally, download the media to a local path, depending on the type of media
    if (local) {
      const mediaDownloadResponse =
        type === "video"
          ? await downloadVideo({ videoUrl, path: localPath, post: post })
          : await downloadImagesAsPdf({ imageUrls: images, path: localPath, post: post });
      if (mediaDownloadResponse.status === "error") {
        log.error("Failed to download media locally, skipping post");
        continue;
      }
    }

    // Download the media as a buffer(s), depending on the type of media
    const mediaBufferResponse =
      type === "video"
        ? await downloadVideoAsBuffer({ videoUrl, post: post })
        : await downloadImagesAsPdfBuffer({ imageUrls: images, post: post });
    if (mediaBufferResponse.status === "error") {
      log.error("Failed to download media as buffer, skipping post");
      continue;
    }

    // Upload the media buffer(s) to S3, depending on the type of media
    if (type === "video") {
      const videoPath = `${S3Path}/video.mp4`;
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

      const pdfPath = `${S3Path}/metadata.pdf`;
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
    }
  }
};
