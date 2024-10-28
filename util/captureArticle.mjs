import dotenv from "dotenv";
dotenv.config();

export const captureArticle = async ({ url, browser }) => {
  if (!url || !browser) {
    console.error("Missing argument(s)");
    return { file: null, name: null };
  }
  const local = process.env.LOCAL;
  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
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
    delay(1000);
    await page.addStyleTag({
      content: `
        @page {
          margin: 1in 0 1in 0;
        }
        @page :first {
          margin-top: 0.5in;
          margin-bottom: 1in;
        }
      `,
    });
    const now = new Date();
    const sanitizedWebUrl = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
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
