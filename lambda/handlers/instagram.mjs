import { downloadImages, downloadVideo } from "./../util/download_media_ig.mjs";
import { formatTimestamp } from "../util/misc_helper.mjs";
import { putToS3, instantiateS3 } from "./../util/s3_helper.mjs";
import { addTime, getLatestTime } from "./../util/manage_db_ig.mjs";
import { fetchInstagramPosts } from "../util/fetch_data.mjs";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";

dotenv.config();

export const instagramHandler = async ({ event, context, callback }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  const latestTimeISO = getLatestTime();
  const currentTime = new Date();
  const latestTime = new Date(latestTimeISO);
  if ((currentTime - latestTime) / (1000 * 60 * 60 * 24) < 7) {
    throw new Error("Latest time is less than 7 days old");
  }

  // Instantiate the AWS S3 client and fetch Instagram posts
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");
  addTime();
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
    const s3Path = `instagram/${sanitizedFileName}`;
    const localPath = `./documents/${sanitizedFileName}`;

    // Download the media (images or video) if local and create a PDF buffer
    if (type === "video") {
      const mediaBufferResponse = await downloadVideo({
        videoUrl,
        videoPath: `${localPath}/video.mp4`,
        metadataPath: `${localPath}/metadata.pdf`,
        post,
        downloadLocally: local,
      });

      await putToS3({
        file: mediaBufferResponse.videoBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}/video.mp4`,
      });
      await putToS3({
        file: mediaBufferResponse.metadataBuffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}/metadata.pdf`,
      });
    }

    if (type === "sidecar") {

      const mediaBufferResponse = await downloadImages({
        imageUrls: images,
        path: `${localPath}.pdf`,
        post,
        downloadLocally: local,
      });

      await putToS3({
        file: mediaBufferResponse.buffer,
        S3Client: s3Client,
        bucketName,
        path: `${s3Path}.pdf`,
      });
    }
  }
};
