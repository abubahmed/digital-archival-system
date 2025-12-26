import dotenv from "dotenv";
import {
    generateAltoFile,
    generateMetsFile,
} from "./../util/mets_alto_dp.mjs";
import { getNewsletterForDate } from "./newsletter.mjs";
import { putToS3, instantiateS3, formatTimestamp } from "./../util/helper.mjs";
import { captureArticle, mergePDFBuffers } from "../../../lib/archivers/dailyprince/dailyprinceService.mjs";
import log from "./../util/logger.mjs";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "node:path";
import { stripHtml } from "./../util/daily_run.mjs";


dotenv.config();

export const dailyPrinceHandler = async ({ event, callback, context }) => {
    const local = false;
    const bucketName = process.env.AWS_BUCKET_NAME;

    // Use articles only (url + optional title/content)
    const { articles = [] } = event || {};

    // If no articles provided, return early with success but no content
    if (!Array.isArray(articles) || articles.length === 0) {
        log.info("No articles found for this date");
        return {
            ok: true,
            noContent: true,
            message: "No articles found for this date"
        };
    }

    // Filter out any malformed entries (missing url), but keep order
    const validArticles = articles.filter(a => a && typeof a.url === "string" && a.url.length > 0);
    if (validArticles.length === 0) {
        log.info("No valid article URLs found for this date");
        return {
            ok: true,
            noContent: true,
            message: "No valid article URLs found for this date"
        };
    }
    if (validArticles.length !== articles.length) {
        log.warn(`Some articles were skipped due to missing/invalid url`);
    }

    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: process.env.CHROME_PATH || undefined,
        args: [
            "--disable-web-security",
            "--allow-insecure-localhost",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ],
    });
    //log.info("Puppeteer client instantiated");

    // Capture articles from the provided list
    let startingPage = 1;
    const articlesData = [];

    // Establish window: [startDate, endDate)
    // startDate = (today - 1 day) at whatever time today carries; endDate = provided endDate or today
    const startDate = new Date(event.today);
    startDate.setUTCDate(event.today.getUTCDate() - 1);
    const endDate = event.endDate instanceof Date ? event.endDate : new Date(event.today);

    try {
        const newsletters = await getNewsletterForDate({
            date: startDate,
            endDate: endDate,
            browser
        });
        if (Array.isArray(newsletters) && newsletters.length > 0) {
            for (const nl of newsletters) {
                const pages = Array.from({ length: nl.pageCount }, (_, i) => startingPage + i);

                articlesData.push({
                    pdfBuffer: nl.pdfBuffer,
                    pages,
                    url: nl.url,
                    title: stripHtml(nl.title),
                    content: stripHtml(nl.content),
                });

                startingPage += nl.pageCount;
                log.info(`Prepended newsletter (${nl.pageCount} pages)`);
            }
            log.info(`Prepended ${newsletters.length} newsletter(s).`);
        } else {
            log.info(`No newsletter found for window [${startDate.toISOString()} to ${endDate.toISOString()}]`);
        }
        for (const [index, art] of validArticles.entries()) {
            try {
                const response = await captureArticle({
                    url: art.url,
                    browser,
                    header: index === 0,
                    footer: index === validArticles.length - 1,
                    startingPage,
                    // pass through metadata (optional)
                    title: art.title,
                    content: art.content,
                    logger: log,
                });
                log.info(`Captured article: ${art.url}`);
                articlesData.push(response);
                startingPage += response.pages.length;
            } catch (error) {
                log.error(`Failed to capture article ${art.url}: ${error.message}`);
                // Continue with next article instead of failing completely
                continue;
            }
        }

        // If we had valid articles but couldn't capture any of them, that's a failure
        if (articlesData.length === 0) {
            throw new Error(`Failed to capture any of the ${validArticles.length} articles. Please check the logs for specific errors.`);
        }
    } finally {
        await browser.close();
    }

    // Merge all captured articles into a single PDF buffer
    const issueName = `dailyprincetonian_${formatTimestamp(new Date())}`;
    const pdfBuffers = articlesData.map((article) => article.pdfBuffer);
    const generateImages = process.env.GENERATE_IMAGES === 'true';  // Environment variable control for image generation
    const { mergedPdfBytes, pdfPath, imagesDir, pages } = await mergePDFBuffers({
        buffers: pdfBuffers,
        dir: issueName,
        dpi: 400,
        quality: 90,
        generateImages,
        writeToDisk: generateImages, // Need this true to generate images
    });
    log.info("Merged PDF buffer created");

    const pageStartContent = new Map();
    // If two articles start on the same page, join their content with blank lines
    for (const art of articlesData) {
        const startPage = Array.isArray(art.pages) && art.pages.length ? art.pages[0] : null;
        if (!startPage) continue;
        const text = (art.content || "").trim();
        if (!text) continue;
        pageStartContent.set(
            startPage,
            pageStartContent.has(startPage)
                ? `${pageStartContent.get(startPage)}\n\n${text}`
                : text
        );
    }

    // --- Dimensions to match your JP2s (8.5x11 at the same DPI used above)
    const dpiUsed = 400; // keep in sync with mergePDFBuffers({ dpi })
    const pageWidthPx = Math.round(8.5 * dpiUsed);
    const pageHeightPx = Math.round(11 * dpiUsed);

    // 'pages' is the array of JP2 file paths returned by pdfToJpegs, so total pages:
    const totalPages = pages.length;

    const altoBuffers = [];
    const altoFiles = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        // Use article content if this page is a start; otherwise generate a blank ALTO
        const pageText = pageStartContent.get(pageNum) || "";
        // Our JP2 naming pattern is "page-%04d.jp2"
        const sourceImageName = `page-${String(pageNum).padStart(4, "0")}.jp2`;

        const { altoBuffer, name } = generateAltoFile({
            dir: path.posix.join(issueName, "alto"),
            pageText,                 // empty string => blank ALTO (no TextBlock)
            pageId: pageNum,          // 1-based numbering
            pageWidth: pageWidthPx,
            pageHeight: pageHeightPx,
            measurementUnit: "pixel",
            sourceImage: sourceImageName,
            downloadLocally: false,
            // schema: "v4", // or "docworks14" if you need that flavor

        });

        log.info(
            pageText
                ? `ALTO (with text) generated for page ${pageNum}: ${name}`
                : `ALTO (blank) generated for page ${pageNum}: ${name}`
        );
        altoBuffers.push({ buffer: altoBuffer, name });

        const relHref = `file://./alto/${name}`;

        altoFiles.push({
            page: pageNum,
            relHref,
            name,
            mimetype: "text/xml",
        });
    }

    log.info(`Generated ${altoBuffers.length} ALTO files (one per page; text only on start pages).`);

    const imageFiles = pages.map((p, idx) => ({
        page: idx + 1,            // 1-based page number
        relHref: `file://./images/${path.basename(p)}`,
        name: path.basename(p),   // e.g., page-0001.jp2
    }));

    // Generate METS file from merged PDF buffer and ALTO files
    const metsResponse = generateMetsFile({
        articlesData,
        issueDate: endDate, // Use end date for METS issue date
        dir: issueName,
        downloadLocally: false,
        imageFiles,
        altoFiles,
        issueNumber: 1,
        volumeNumber: 147, // hardcoded for now; update as needed
    });
    log.info("METS file generated");

    const artifacts = {
        pdf: { name: `${issueName}.pdf`, data: Buffer.from(mergedPdfBytes).toString("base64") },
        mets: { name: "mets.xml", data: Buffer.from(metsResponse.buffer, "utf-8").toString("base64") },
        alto: altoBuffers.map(({ buffer, name }) => ({
            name,
            data: buffer.toString("base64"),
        }))
    };

    // Only add images to artifacts if they were generated
    if (generateImages) {
        artifacts.images = pages.map(imagePath => ({
            name: path.basename(imagePath),
            data: fs.readFileSync(imagePath).toString("base64")
        }));
    }

    return {
        ok: true,
        issueName,
        issueDate: endDate?.toISOString?.().slice(0, 10), // Use end date for response
        artifacts
    };

    /*
    // Upload the merged PDF buffer, METS file, and ALTO files to S3
    await putToS3({
      file: mergedPDFBuffer,
      S3Client: s3Client,
      bucketName,
      path: `dailyprince/${issueName}/${issueName}.pdf`,
    });
    log.info(`Issue PDF uploaded to S3: ${issueName}.pdf`);
  
    await putToS3({
      file: metsResponse.buffer,
      S3Client: s3Client,
      bucketName,
      path: `dailyprince/${issueName}/mets.xml`,
    });
    log.info(`METS file uploaded to S3: mets.xml`);
  
    for (const altoBuffer of altoBuffers) {
      await putToS3({
        file: altoBuffer.buffer,
        S3Client: s3Client,
        bucketName,
        path: `dailyprince/${issueName}/${altoBuffer.name}`,
      });
      log.info(`ALTO file uploaded to S3: ${altoBuffer.name}`);
    }
    */
};
