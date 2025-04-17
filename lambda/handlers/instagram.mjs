import { S3Client } from "@aws-sdk/client-s3";
import { downloadImages, downloadVideo } from "./../util/download_media_ig.mjs";
import { putToS3, formatTimestamp } from "./../util/helper.mjs";
import { addTime, getLatestTime } from "./../util/manage_db_ig.mjs";
import { fetchInstagramPosts } from "./../util/api.mjs";
import log from "./../util/logger.mjs";
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
  const latestTimeISO = getLatestTime();
  addTime();

  // Fetch all Instagram posts posted after the most recent archival time
  const posts = await fetchInstagramPosts({ after: latestTimeISO });
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
    let mediaBufferResponse =
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
      await putToS3({
        file: mediaBufferResponse.videoBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${S3Path}/video.mp4`,
      });
      await putToS3({
        file: mediaBufferResponse.metadataBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${S3Path}/metadata.pdf`,
      });
    } else {
      await putToS3({
        file: mediaBufferResponse.buffer,
        S3Client: s3Client,
        bucketName,
        path: `${S3Path}.pdf`,
      });
    }
  }
};
