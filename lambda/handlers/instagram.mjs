import { S3Client } from "@aws-sdk/client-s3";
import { downloadImages, downloadVideo } from "@/util/download_media_ig.mjs";
import { putToS3, formatTimestamp } from "@/util/helper.mjs";
import { addTime, getLatestTime } from "@/util/manage_db_ig.mjs";
import { fetchInstagramPosts } from "@/util/api.mjs";
import log from "@/util/logger.mjs";
import dotenv from "dotenv";

dotenv.config();

export const instagramHandler = async ({ event, context, callback }) => {
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

    // Download the media (images or video) if local and create a PDF buffer
    const mediaBufferResponse =
      type === "video"
        ? await downloadVideo({
            videoUrl,
            path: localPath,
            post,
            downloadLocally: local,
          })
        : await downloadImages({
            imageUrls: images,
            path: localPath,
            post,
            downloadLocally: local,
          });

    // Upload the media buffer(s) to S3, depending on the type of media
    if (type === "video") {
      const S3VideoResponse = await putToS3({
        file: mediaBufferResponse.videoBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${S3Path}/video.mp4`,
      });
      if (S3VideoResponse.status === "error" || S3VideoResponse?.response.$metadata.httpStatusCode != 200) {
        log.error("Failed to upload video to S3, skipping post");
        continue;
      }

      const S3MetadataResponse = await putToS3({
        file: mediaBufferResponse.metadataBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${S3Path}/metadata.pdf`,
      });
      if (S3MetadataResponse.status === "error" || S3MetadataResponse?.response.$metadata.httpStatusCode != 200) {
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
