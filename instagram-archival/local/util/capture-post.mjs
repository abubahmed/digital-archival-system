import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
dotenv.config();

export const capturePost = async ({ url, browser }) => {
  if (!url || !browser) {
    console.error("Missing argument(s)");
    return { file: null, name: null };
  }
  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  const local = process.env.LOCAL;
  const page = await browser.newPage();
  try {
    const domain = new URL(url).host;
    const cookies = [
      {
        name: "max-age",
        value: `${60 * 60 * 24 * 2}`,
        url: url,
        domain: domain,
        path: "/",
        expires: new Date().getTime(),
        "max-age": 60 * 60 * 24 * 2,
      },
    ];
    console.log(`Setting cookies for ${url}`);
    await page.setCookie(...cookies);
    console.log(`Navigating to ${url}`);
    await page.goto(url, {
      timeout: 120000,
      waitUntil: ["networkidle2", "domcontentloaded"],
    });
    try {
      await page.waitForSelector(
        'div[role="button"][tabindex="0"] > div > svg[aria-label="Close"]',
        { timeout: 3000 }
      );
      await page.click('div[role="button"][tabindex="0"] > div > svg[aria-label="Close"]');
    } catch (error) {}
    await page.evaluate(() => {
      const elements = document.querySelectorAll("a img");
      for (var i = 0; i < elements.length; i++) {
        elements[i].parentNode.removeChild(elements[i]);
      }
    });
    const resultSrcs = await page.evaluate(async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const result = new Set();
      for (let i = 0; i < 20; i++) {
        const moreButton = document.querySelector("._afxw._al46._al47");
        if (!moreButton) {
          break;
        }
        const srcs = Array.from(document.querySelectorAll("._aagv img")).map((image) =>
          image.getAttribute("src")
        );
        srcs.forEach((src) => result.add(src));
        moreButton.click();
        await delay(500);
      }
      return Array.from(result);
    });

    console.log("Images found:", resultSrcs);
    const sanitizedWebUrl = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    resultSrcs.forEach(async (src, index) => {
      await downloadImage(src, `documents/${sanitizedWebUrl}_${index}.jpg`);
    });
    await page.waitForFunction(() => false);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const currentDateTime = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    console.log(currentDateTime);
    const fileName = `${sanitizedWebUrl}_${currentDateTime}.pdf`;
    console.log(`Capturing article at ${url}`);
    const pdfOptions = {
      width: "8.5in",
      height: "11in",
      displayHeaderFooter: true,
      margin: { top: "1in", bottom: "1in" },
    };
    if (local) {
      pdfOptions.path = `documents/${fileName}`;
    }
    const pdfBuffer = await page.pdf(pdfOptions);
    console.log(`Captured article at ${url}`);
    return { file: pdfBuffer, name: fileName };
  } catch (error) {
    console.error(error);
    return { file: null, name: null };
  } finally {
    await page.close();
    console.log(`Closed page for ${url}`);
  }
};

const downloadImage = async (url, filepath) => {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("Error downloading the image:", error);
  }
};

// for (const url of event.instagramUrls) {
//   const { file, name } = await capturePost({ url, browser });
//   if (!file || !name) {
//     return console.error("Failed to capture Instagram post");
//   }
//   const path = "https://www.instagram.com/dailyprincetonian/";
//   const sanitizedPath = path.replace(/[^a-z0-9]/gi, "_").toLowerCase();
//   const command = new PutObjectCommand({
//     Bucket: bucketName,
//     Key: `${sanitizedPath}/${name}`,
//     Body: file,
//   });
//   const response = await s3Client.send(command);
//   console.log("S3 response:", response);
// }
