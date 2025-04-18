import { formatTimestamp, putToS3, instantiateS3 } from "../util/helper.mjs";
import TimeDatabase from "../util/manage_db.mjs";
import mailchimp from "@mailchimp/mailchimp_marketing";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";

dotenv.config();

export const newsletterHandler = async ({ event, context, callback }) => {
  const local = process.env.LOCAL;
  const bucketName = process.env.AWS_BUCKET_NAME;

  const timeDatabase = new TimeDatabase("newsletter");
  const latestTime = timeDatabase.getLatestTime();
  const currentTime = new Date();
  if ((currentTime - latestTime) / (1000 * 60 * 60 * 24) < 7) {
    throw new Error("Latest time is less than 7 days old");
  }

  // Instantiate the AWS S3 client and fetch Instagram posts
  const s3Client = instantiateS3();
  log.info("AWS S3 client instantiated");

  const { newsletters: posts, latestTime: newestLatestTime } = await fetchNewsletters({ after: latestTime });
  log.info(`${newsletters.length} newsletters fetched`);

  // Iterate through each post and process it
  let processedPosts = 0;
  for (const post of posts) {
    processedPosts++;
    log.info(`Processing post ${processedPosts}/${posts.length}`);
    const { id, archive_url, long_archive_url, create_time } = post;

    // Define the S3 path and local path for storing the resultant media
    const fileName = archive_url + formatTimestamp(create_time);
    const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const s3Path = `newsletter/${sanitizedFileName}`;
    const localPath = `./documents/${sanitizedFileName}`;

    // Download the media (images or video) if local and create a PDF buffer
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
};

export const fetchNewsletters = async ({ after = new Date(0) }) => {
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: "us7",
  });
  const response = await mailchimp.campaigns.list({
    count: 100,
    offset: 0,
    since_create_time: after,
    sort_field: "create_time",
  })
  const newsletters = response.campaigns.filter(
    (newsletter) => newsletter.long_archive_url && newsletter.create_time
      && newsletter.id && newsletter.archive_url
  );
  if (newsletters.length === 0) throw new Error("No newsletters found after the specified date");
  const latestTime = new Date(newsletters[newsletters.length - 1].create_time)
  return {
    newsletters,
    latestTime,
  }
};
