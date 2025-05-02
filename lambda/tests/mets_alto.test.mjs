import fs from "fs";
import log from "./../util/logger.mjs";
import { extractText, generateAltoFile } from "./../util/mets_alto.mjs";

const buffer = fs.readFileSync(
  "./../../documents/https___www_dailyprincetonian_com_article_2024_10_princeton_prospect_artist_question_and_answer_disc_rocky_dj_2025-03-10_16-55-56.pdf"
);

const pages = await extractText({ buffer: buffer });
console.log(pages);

for (const page of pages) {
  const { status, message, altoBuffer, name } = generateAltoFile({
    pageText: page.text,
    pageId: page.number,
  });
  if (status === "error") {
    log.error(`Failed to generate ALTO file: ${message}`);
    continue;
  }
  log.info(`ALTO file generated: ${name}`);
}





