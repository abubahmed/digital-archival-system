export const captureArticle = async ({ url, browser }) => {
  if (!url || !browser) {
    console.error("Missing argument(s)");
    return { file: null, name: null };
  }
  const page = await browser.newPage();
  try {
    const domain = new URL(url).host;
    let now = new Date();
    now.setHours(48);
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
    await page.addStyleTag({
      content: `
        @page {
          margin: 1in 0 1in 0;
        }
        @page :first {
          margin-top: 0.75in;
          margin-bottom: 1in;
        }
      `,
    });
    const sanitizedWebUrl = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const currentDateTime = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${sanitizedWebUrl}_${currentDateTime}.pdf`;
    console.log(`Capturing article at ${url}`);
    const pdfBuffer = await page.pdf({
      width: "8.5in",
      height: "11in",
      displayHeaderFooter: true,
      margin: { top: "1in", bottom: "1in" },
    });
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
