import { getArticlesFromMonth, captureArticle } from "../util/helper.mjs";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

getArticlesFromMonth({
  month: 3,
  year: 2024,
}).then((response) => {
  console.log("Response:", response);
});

const browser = await puppeteer.launch({
  headless: true,
  args: ["--disable-web-security", "--allow-insecure-localhost"],
});

captureArticle({
  browser,
  url: "https://www.dailyprincetonian.com/article/2024/10/princeton-data-blog-frosh-survey-2028-results-analysis-chart-crosstab-longitudinal",
}).then(async (response) => {
  console.log("Response:", response);
  await browser.close();
});
