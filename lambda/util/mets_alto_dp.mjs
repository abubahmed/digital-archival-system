import { PDFExtract } from "pdf.js-extract";
import fs from "fs";
import log from "./logger.mjs";
import xml2js from "xml2js";
import { formatTimestamp } from "./helper.mjs";

export const generateAltoFile = ({ pageText, pageId, dir, downloadLocally = false }) => {
  const altoObject = {
    "alto:alto": {
      $: {
        "xmlns:alto": "http://www.loc.gov/standards/alto/ns-v4#",
      },
      "alto:Layout": {
        "alto:Page": {
          $: {
            ID: `page_${pageId}`,
          },
          "alto:TextBlock": {
            "alto:String": {
              _: pageText,
            },
          },
        },
      },
    },
  };

  const builder = new xml2js.Builder();
  const altoXML = builder.buildObject(altoObject);
  if (downloadLocally && dir) {
    const path = `./../documents/${dir}/`;
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(path + `alto_${pageId}.xml`, altoXML);
  }

  return {
    status: "success",
    message: "ALTO file created",
    altoBuffer: altoXML,
    name: `alto_${pageId}.xml`,
  };
};

export const generateMetsFile = ({ articlesData, dir, downloadLocally = false }) => {
  const metsXmlObject = {
    "mets:mets": {
      $: {
        "xmlns:mets": "http://www.loc.gov/METS/",
        "xmlns:xlink": "http://www.w3.org/1999/xlink",
      },
      "mets:metsHdr": {
        $: {
          CREATEDATE: new Date().toISOString(),
        },
        "mets:agent": {
          $: {
            ROLE: "CREATOR",
            TYPE: "ORGANIZATION",
          },
          "mets:name": "Automated Articles Issue Archiver",
        },
      },
      "mets:fileSec": {
        "mets:fileGrp": [
          {
            $: { USE: "PDF" },
            "mets:file": {
              $: {
                ID: "full_pdf",
                MIMETYPE: "application/pdf",
              },
              "mets:FLocat": {
                $: {
                  "xlink:href": `dailyprince-issue_${formatTimestamp(new Date())}.pdf`,
                },
              },
            },
          },
          {
            $: { USE: "ALTO" },
            "mets:file": articlesData.flatMap((article) =>
              article.pages.map((page) => ({
                $: {
                  ID: `alto_${page}`,
                  MIMETYPE: "text/xml",
                },
                "mets:FLocat": {
                  $: {
                    "xlink:href": `page_${page}.alto.xml`,
                  },
                },
              }))
            ),
          },
        ],
      },
      "mets:structMap": {
        $: { TYPE: "logical" },
        "mets:div": articlesData.map((article, idx) => ({
          $: {
            TYPE: "article",
            LABEL: article.title,
          },
          "mets:mptr": {
            $: {
              "xlink:href": article.url,
            },
          },
          "mets:div": article.pages.map((page) => ({
            $: {
              TYPE: "page",
              LABEL: `Page ${page}`,
            },
            "mets:fptr": {
              $: {
                FILEID: `alto_${page}`,
              },
            },
          })),
        })),
      },
    },
  };

  const builder = new xml2js.Builder({ renderOpts: { pretty: true, indent: "  ", newline: "\n" } });
  const xmlString = builder.buildObject(metsXmlObject);
  if (downloadLocally && dir) {
    const path = `./../documents/${dir}/`;
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(path + "mets.xml", xmlString);
  }

  return {
    status: "success",
    message: "METS file created",
    metsBuffer: xmlString,
  };
};

export const extractText = async ({ buffer }) => {
  const pdfExtract = new PDFExtract();
  const options = {};
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
};
