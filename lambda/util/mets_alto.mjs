import { PDFExtract } from "pdf.js-extract";
import fs from "fs";
import log from "./logger.mjs";
import xml2js from "xml2js";

export const generateAltoFile = ({ pageText, pageId }) => {
  const builder = new xml2js.Builder();
  const altoObject = {
    "alto:alto": {
      $: {
        "xmlns:alto": "http://www.loc.gov/standards/alto/ns-v4#",
      },
      "alto:Layout": {
        "alto:Page": [
          {
            $: {
              ID: `${pageId}`,
            },
            "alto:TextBlock": [
              {
                "alto:String": [
                  {
                    _: pageText,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };

  const altoXML = builder.buildObject(altoObject);
  const altoPath = `./../documents/page_${pageId}.xml`;
  fs.writeFileSync(altoPath, altoXML);
  return {
    status: "success",
    message: "ALTO file created",
    altoBuffer: altoXML,
    name: `page_${pageId}.xml`,
  };
};

export const generateMetsFile = ({ articles }) => {
  const builder = new xml2js.Builder();
  const metsObject = {
    "mets:mets": {
      $: {
        xmlns: "http://www.loc.gov/METS/",
        "xmlns:alto": "http://www.loc.gov/standards/alto/ns-v4#",
      },
      "mets:structure": {
        "mets:div": articles.map((article, index) => ({
          $: { TYPE: "article" },
          "mets:fptr": article.pages.map((page) => ({
            $: {
              FILEID: `alto_${article.title.replace(/ /g, "_")}_page_${page}`,
            },
          })),
        })),
      },
      "mets:fileSec": {
        "mets:fileGrp": {
          $: { USE: "alto" },
          "mets:file": articles.flatMap((article, index) =>
            article.pages.map((page, pageIndex) => ({
              $: {
                ID: `alto_${article.title.replace(/ /g, "_")}_page_${page}`,
                MIMETYPE: "application/xml",
              },
              "mets:FLocat": {
                $: {
                  "xlink:type": "simple",
                  "xlink:href": `https://example.com/alto_files/alto_${article.title.replace(
                    / /g,
                    "_"
                  )}_page_${page}.xml`,
                },
              },
            }))
          ),
        },
      },
    },
  };
  const metsXML = builder.buildObject(metsObject);
  const metsPath = `./../documents/mets_page.xml`;
  fs.writeFileSync(metsPath, metsXML);
  return {
    status: "success",
    message: "ALTO file created",
    metsBuffer: metsXML,
    name: `mets_page.xml`,
  };
};

export const extractText = async ({ buffer }) => {
  const pdfExtract = new PDFExtract();
  const options = {};
  try {
    const data = await pdfExtract.extractBuffer(buffer, options);
    const pages = [];
    for (const page of data.pages) {
      const text = page.content.map((content) => content.str).join(" ");
      pages.push({
        text: text,
        number: page.pageInfo.num,
      });
    }
    return pages;
  } catch (error) {
    log.error(error);
    return [];
  }
};
