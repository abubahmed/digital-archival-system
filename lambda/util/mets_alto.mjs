import { PDFExtract } from "pdf.js-extract";
import fs from "fs";
import log from "./logger.mjs";
import xml2js from "xml2js";
import { formatTimestamp } from "./helper.mjs";

export const generateAltoFile = ({ pageText, pageId, dir }) => {
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
  const path = `./../documents/${dir}/`;
  fs.mkdirSync(path, { recursive: true });
  fs.writeFileSync(path + `page_${pageId}.alto.xml`, altoXML);
  return {
    status: "success",
    message: "ALTO file created",
    altoBuffer: altoXML,
    name: `page_${pageId}.xml`,
  };
};

export const generateMetsFile = ({ articlesData, dir }) => {
  const metsXmlObject = {
    "mets:mets": {
      $: {
        "xmlns:mets": "http://www.loc.gov/METS/",
        "xmlns:xlink": "http://www.w3.org/1999/xlink",
        "xmlns:mods": "http://www.loc.gov/mods/v3",
        "xmlns:alto": "http://www.loc.gov/standards/alto/ns-v4#",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation": "http://www.loc.gov/METS/ http://www.loc.gov/standards/mets/mets.xsd",
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
            $: {
              USE: "PDF",
            },
            "mets:file": {
              $: {
                ID: "full_pdf",
                MIMETYPE: "application/pdf",
              },
              "mets:FLocat": {
                $: {
                  "xlink:href": "dailyprince-issue_" + formatTimestamp(new Date()) + ".pdf",
                },
              },
            },
          },
          {
            $: {
              USE: "ALTO",
            },
            "mets:file": articlesData.flatMap((article) => {
              const files = [];
              for (const page of article.pages) {
                files.push({
                  $: {
                    ID: `alto_${page}`,
                    MIMETYPE: "text/xml",
                  },
                  "mets:FLocat": {
                    $: {
                      LOCTYPE: "URL",
                      "xlink:href": `page_${page}.alto.xml`,
                    },
                  },
                });
              }
              return files;
            }),
          },
        ],
      },
      "mets:structMap": {
        $: {
          TYPE: "logical",
        },
        "mets:div": articlesData.map((article, idx) => {
          const articleDiv = {
            $: {
              TYPE: "article",
              LABEL: article.title,
              DMDID: `dmd${idx + 1}`,
            },
            "mets:mptr": {
              $: {
                "xlink:href": article.url,
              },
            },
            "mets:div": [],
          };

          for (const page of article.pages) {
            articleDiv["mets:div"].push({
              $: {
                TYPE: "page",
                LABEL: `Page ${page}`,
                FILEID: `alto_${page}`,
              },
              "mets:fptr": {
                $: {
                  FILEID: `alto_${page}`,
                },
              },
            });
          }
          return articleDiv;
        }),
      },
    },
  };

  const builder = new xml2js.Builder({ renderOpts: { pretty: true, indent: "  ", newline: "\n" } });
  const xmlString = builder.buildObject(metsXmlObject);
  const path = `./../documents/${dir}/`;
  fs.mkdirSync(path, { recursive: true });
  fs.writeFileSync(path + "mets.xml", xmlString);
  return {
    status: "success",
    message: "METS file created",
    metsBuffer: xmlString,
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
