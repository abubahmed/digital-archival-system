import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import {
  downloadImagesAsPdf,
  downloadImagesAsPdfBuffer,
  downloadVideoAsBuffer,
  downloadVideo,
} from "./util/download_media.mjs";
import { putToS3, formatTimestamp, fetchInstagramPosts } from "./util/misc.mjs";
import { addTime, getLatestTime } from "./util/manage_db.mjs";
import log from "./util/logger.mjs";
dotenv.config();

// Instantiate the AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: process.env.LOCAL
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      }
    : undefined,
});
log.info("AWS S3 client instantiated");

export const handler = async (event, context, callback) => {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const local = process.env.LOCAL;

  try {
    // Retrieve the last time the archival process was run from the database
    const latestTimeResponse = getLatestTime();
    if (latestTimeResponse.status === "error") {
      log.error("Failed to get latest archival time");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to get latest archival time" }),
      };
    }
    const latestTimeISO = latestTimeResponse.time;

    // Add the current time as a new time entry to the database
    const addTimeResponse = addTime();
    if (addTimeResponse.status === "error") {
      log.error("Failed to add new archival time");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to add new archival time" }),
      };
    }

    // Fetch all Instagram posts posted after the most recent archival time
    const { status, posts, postsCount } = await fetchInstagramPosts({ after: latestTimeISO });
    if (status === "error") {
      log.error("Failed to fetch Instagram posts");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to fetch Instagram posts" }),
      };
    }

    // Handle the case where no new posts were found
    if (posts.length === 0) {
      log.error("No Instagram posts fetched");
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "No Instagram posts found" }),
      };
    }
    log.info(`${postsCount} Instagram posts fetched`);

    // Iterate through each post and process it
    let processedPosts = 0;
    for (const post of posts) {
      processedPosts++;
      log.info(`Processing post ${processedPosts}/${postsCount}`);

      // Validate the post data, ensuring all required fields are present
      const { images, videoUrl, type, timestamp, url, postId } = post;
      if ((!images || images.length === 0) && !videoUrl) {
        log.error("Missing image(s) or video URL");
        continue;
      } else if (!timestamp || !type || !url || !postId) {
        log.error("Missing post metadata");
        continue;
      }

      // Define the S3 path and local path for storing the resultant media
      const fileName = url + formatTimestamp({ timestamp });
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

      continue;
      // Upload the media buffer(s) to S3, depending on the type of media, and check for errors
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
    log.info(`Instagram archival process complete, ${processedPosts} posts processed`);
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
