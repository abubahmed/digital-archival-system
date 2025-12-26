import { putToS3, instantiateS3, formatTimestamp, beautifyTimestamp, sanitizeFileName, sanitizeText } from "./../util/helper.mjs";
import { fetchInstagramPosts, downloadImagesInstagram, downloadVideoInstagram } from "../../../lib/archivers/instagram/instagramService.mjs";
import TimeDatabase from "../util/manage_db.mjs";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const instagramHandler = async ({ event, context, callback }) => {
    const local = process.env.LOCAL;
    const bucketName = process.env.AWS_BUCKET_NAME;
    const timeDatabase = new TimeDatabase("instagram");
    const latestTime = timeDatabase.getLatestTime();
    const currentTime = new Date();
    if ((currentTime - latestTime) / (1000 * 60 * 60 * 24) < 7) {
        throw new Error("Latest time is less than 7 days old");
    }

    // Instantiate the AWS S3 client and fetch Instagram posts
    const s3Client = instantiateS3();
    log.info("AWS S3 client instantiated");
    timeDatabase.addTime();
    const posts = await fetchInstagramPosts({
        after: latestTime,
        apifyToken: process.env.APIFY_TOKEN,
        logger: log
    });
    log.info(`${posts.length} Instagram posts fetched`);

    // Iterate through each post and process it
    let processedPosts = 0;
    for (const post of posts) {
        processedPosts++;
        log.info(`Processing post ${processedPosts}/${posts.length}`);
        const { images, videoUrl, type, timestamp, url } = post;
        const fileName = `${sanitizeFileName(url)}_${formatTimestamp(timestamp)}.pdf`;
        const s3Path = `instagram/${fileName}`;
        const localPath = `./documents/${fileName}`;

        // Download the media (images or video) if local and create a PDF buffer
        if (type === "video") {
            const mediaBufferResponse = await downloadVideoInstagram({
                videoUrl,
                videoPath: `${localPath}/video.mp4`,
                metadataPath: `${localPath}/metadata.pdf`,
                post,
                downloadLocally: local,
                fontPath: path.join(process.cwd(), "src", "fonts", "arial.ttf"),
                formatTimestamp,
                beautifyTimestamp,
                sanitizeText,
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
            const mediaBufferResponse = await downloadImagesInstagram({
                imageUrls: images,
                path: `${localPath}.pdf`,
                post,
                downloadLocally: local,
                fontPath: path.join(process.cwd(), "src", "fonts", "arial.ttf"),
                formatTimestamp,
                beautifyTimestamp,
                sanitizeText,
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

