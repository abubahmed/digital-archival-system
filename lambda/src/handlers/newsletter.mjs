import { formatTimestamp, putToS3, instantiateS3, sanitizeFileName } from "../util/helper.mjs";
import { fetchNewslettersInWindow, captureNewsletter } from "../../../lib/archivers/newsletter/newsletterService.mjs";
import fs from "fs";
import path from "path";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

/**
 * Handler: archives any Mailchimp campaigns sent in the 24 hours before `event.date`.
 * - `event.date` (optional): a JS Date; defaults to new Date().
 *   Window = [date - 24h, date)
 */
export const newsletterHandler = async ({ event, context, callback }) => {
    //const local = process.env.LOCAL;
    const local = true; // For testing purposes, set to true
    const bucketName = process.env.AWS_BUCKET_NAME;

    // Resolve end date (default: now) and start = end - 24h
    const end = event?.date instanceof Date ? event.date : new Date();
    if (isNaN(end.getTime())) throw new Error("Invalid event.date; must be a Date");
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const s3Client = instantiateS3();
    log.info("AWS S3 client instantiated");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--disable-web-security", "--allow-insecure-localhost"],
    });
    log.info("Puppeteer client instantiated");

    try {
        const { newsletters } = await fetchNewslettersInWindow({ 
            start, 
            end, 
            pageSize: 100,
            apiKey: process.env.MAILCHIMP_API_KEY
        });
        if (newsletters.length === 0) {
            log.info(`No newsletters found in window ${start.toISOString()} to ${end.toISOString()}`);
            return;
        }

        if (newsletters.length > 1) {
            log.info(`Found ${newsletters.length} newsletters in the window; processing all.`);
        }

        let processed = 0;
        for (const post of newsletters) {
            processed++;
            log.info(`Processing ${processed}/${newsletters.length}`);

            const { long_archive_url, send_time, create_time } = post;
            const ts = new Date(send_time ?? create_time);
            const fileName = `${sanitizeFileName(long_archive_url)}_${formatTimestamp(ts)}.pdf`;

            const pdfBuffer = await captureNewsletter({ url: long_archive_url, browser });

            if (local) {
                const localPath = `./documents/newsletters/${fileName}`;
                fs.mkdirSync(path.dirname(localPath), { recursive: true });
                fs.writeFileSync(localPath, pdfBuffer);
            }

            /*await putToS3({
              file: pdfBuffer,
              S3Client: s3Client,
              bucketName,
              path: `newsletters/${fileName}`,
            });*/
        }
    } finally {
        await browser.close();
    }
};


import { getNewsletterForDate as getNewsletterForDateLib, filterNewsletterText } from "../../../lib/archivers/newsletter/newsletterService.mjs";

export const getNewsletterForDate = async ({ date, endDate, browser }) => {
    return await getNewsletterForDateLib({
        date,
        endDate,
        browser,
        apiKey: process.env.MAILCHIMP_API_KEY,
        logger: log
    });
};

export { filterNewsletterText };

//await newsletterHandler({
//  event: { date: new Date("2023-09-13T10:00:00Z") }
//});