import { getArticlesFromMonth, captureArticle } from "./../util/api.mjs";
import { mergePDFBuffers } from "./../util/helper.mjs";
import puppeteer from "puppeteer";
import log from "./../util/logger.mjs";
import dotenv from "dotenv";
dotenv.config();

const browser = await puppeteer.launch({
  headless: true,
  args: ["--disable-web-security", "--allow-insecure-localhost"],
});

const event = {
  webUrls: [
    "https://www.dailyprincetonian.com/article/2024/10/princeton-data-blog-frosh-survey-2028-results-analysis-chart-crosstab-longitudinal",
    "https://www.dailyprincetonian.com/article/2024/10/princeton-data-blog-frosh-survey-2028-results-analysis-chart-crosstab-longitudinal",
    "https://www.dailyprincetonian.com/article/2024/10/princeton-data-blog-frosh-survey-2028-results-analysis-chart-crosstab-longitudinal",
  ],
};

const pdfBuffers = [];
for (const [index, url] of event.webUrls.entries()) {
  const { status, file, name, message } = await captureArticle({
    url: url,
    browser: browser,
    header: index === 0,
    footer: index === event.webUrls.length - 1,
  });
  if (status === "error") {
    log.error(`Failed to capture article: ${message}`);
    continue;
  }
  pdfBuffers.push({
    file: file,
    name: name,
  });
}
await mergePDFBuffers({
  buffers: pdfBuffers.map(({ file }) => file),
});
browser.close();
