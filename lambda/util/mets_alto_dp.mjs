import { PDFExtract } from "pdf.js-extract";
import fs from "fs";
import xml2js from "xml2js";
import { formatTimestamp } from "./helper.mjs";

export const generateAltoFile = ({
  pageText,
  pageId,
  dir,
  downloadLocally = true,
  pageWidth = 2550,
  pageHeight = 3300,
  measurementUnit = "pixel",
  sourceImage = `page_${pageId}.jpg`,
  schema = "v4", // "v4" (default) or "docworks14"
}) => {
  const haveText = !!(pageText && pageText.trim());

  // --- Root attrs per schema selection ---
  const rootAttrs =
    schema === "docworks14"
      ? {
          // docWorks 1.4-style header
          "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "xsi:noNamespaceSchemaLocation":
            "http://schema.ccs-gmbh.com/docworks/alto-1-4.xsd",
          "xmlns:xlink": "http://www.w3.org/1999/xlink",
          // Keep a default namespace even in 1.4 style (empty/no-namespace is common there;
          // most parsers will still accept a default v4 ns omitted. If you want *strict*
          // docWorks behavior, you can omit `xmlns` entirely.)
        }
      : {
          // ALTO v4-style header (Library of Congress)
          xmlns: "http://www.loc.gov/standards/alto/ns-v4#",
          "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "xsi:schemaLocation":
            "http://www.loc.gov/standards/alto/ns-v4# http://www.loc.gov/standards/alto/v4/alto-4-2.xsd",
          "xmlns:xlink": "http://www.w3.org/1999/xlink",
        };

  // --- Core structure ---
  const altoObject = {
    alto: {
      $: rootAttrs,
      Description: {
        MeasurementUnit: measurementUnit, // "pixel" | "inch" | "millimeter"
        sourceImageInformation: { fileName: sourceImage },
      },
      Layout: {
        Page: {
          $: {
            ID: `page_${pageId}`,
            PHYSICAL_IMG_NR: String(pageId),
            WIDTH: String(pageWidth),
            HEIGHT: String(pageHeight),
          },
          PrintSpace: {
            $: {
              HPOS: "0",
              VPOS: "0",
              WIDTH: String(pageWidth),
              HEIGHT: String(pageHeight),
            },
            // Only include text structure if we actually have text
            ...(haveText && {
              TextBlock: {
                $: {
                  ID: `tb_${pageId}_1`,
                  HPOS: "100",
                  VPOS: "100",
                  WIDTH: String(pageWidth - 200),
                  HEIGHT: "200",
                },
                TextLine: {
                  $: {
                    ID: `tl_${pageId}_1`,
                    HPOS: "110",
                    VPOS: "120",
                    WIDTH: String(pageWidth - 220),
                    HEIGHT: "40",
                    BASELINE: "150",
                  },
                  String: {
                    $: {
                      ID: `str_${pageId}_1`,
                      CONTENT: pageText.trim(),
                      HPOS: "110",
                      VPOS: "120",
                      WIDTH: String(pageWidth - 220),
                      HEIGHT: "40",
                    },
                  },
                },
              },
            }),
          },
        },
      },
    },
  };

  const builder = new xml2js.Builder({
    headless: false,
    xmldec: { version: "1.0", encoding: "UTF-8" },
    renderOpts: { pretty: true },
  });

  const altoXML = builder.buildObject(altoObject);
  const altoBuffer = Buffer.from(altoXML, "utf-8");

  if (downloadLocally && dir) {
    const path = `./documents/${dir}/`;
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(path + `alto_${pageId}.xml`, altoXML);
  }

  return { altoBuffer, name: `alto_${pageId}.xml` };
};

// --- helper: normalize an image entry (string -> { href }) ---
function normImg(entry) {
  if (typeof entry === "string") return { href: entry };
  return entry || {};
}

// --- build one <mets:techMD> for an image using MIX ---
function buildImageTechMD(img, seq) {
  const {
    id,                 // optional explicit techMD ID
    href,               // required (file path or URL)
    mimetype = "image/jp2",
    width,              // optional (px)
    height,             // optional (px)
    colorSpace,         // optional (e.g., "RGB", "Grayscale")
    compressionScheme,  // optional (e.g., "JPEG")
  } = img;

  // Minimal, schema-friendly MIX structure
  const mixNode = {
    "mix:mix": {
      "mix:BasicDigitalObjectInformation": {
        "mix:FormatName": mimetype,
      },
      "mix:BasicImageInformation": {
        "mix:BasicImageCharacteristics": {
          ...(Number.isFinite(width) ? { "mix:ImageWidth": String(width) } : {}),
          ...(Number.isFinite(height) ? { "mix:ImageHeight": String(height) } : {}),
          ...(colorSpace ? { "mix:ColorSpace": colorSpace } : {}),
        },
      },
      ...(compressionScheme
        ? {
            "mix:Compression": {
              "mix:CompressionScheme": compressionScheme,
            },
          }
        : {}),
      "mix:ImageCaptureMetadata": {
        "mix:GeneralCaptureInformation": {
          "mix:SourceType": "digitalCameraOrScanner",
        },
      },
    },
  };

  return {
    "mets:techMD": {
      $: { ID: id || `IMG_TECH_${seq}` },
      "mets:mdWrap": {
        $: { MDTYPE: "NISOIMG" },
        "mets:xmlData": mixNode,
      },
    },
  };
}

function makeIssueFileSec({ images = [], alto = [] }) {
  const pickHref = (entry) => entry?.relHref || entry?.href || entry?.path;

  const imgGrp = images.length
    ? {
        $: { ID: "IMGGRP", USE: "Images" },
        "mets:file": images.map((img, i) => ({
          $: {
            ID: img.id || `IMG${String(i + 1).padStart(5, "0")}`,
            MIMETYPE: img.mimetype || "image/jp2",
            ...(img.amdId ? { ADMID: img.amdId } : {}),  // <-- link to amdSec
          },
          "mets:FLocat": {
            $: {
              LOCTYPE: "URL",
              "xlink:href": pickHref(img),
              "xmlns:xlink": "http://www.w3.org/1999/xlink",
            },
          },
        })),
      }
    : null;

  const altoGrp = alto.length
    ? {
        $: { ID: "ALTOGRP", USE: "Text" },
        "mets:file": alto.map((a, i) => ({
          $: {
            ID: a.id || `ALTO${String(i + 1).padStart(5, "0")}`,
            MIMETYPE: a.mimetype || "text/xml",
            // Usually no ADMID for ALTO, unless you also build text techMD
          },
          "mets:FLocat": {
            $: {
              LOCTYPE: "URL",
              "xlink:href": pickHref(a),
              "xmlns:xlink": "http://www.w3.org/1999/xlink",
            },
          },
        })),
      }
    : null;

  const fileGrps = [imgGrp, altoGrp].filter(Boolean);
  return fileGrps.length
    ? { "mets:fileSec": { $: { xmlns: "http://www.loc.gov/METS/" }, "mets:fileGrp": fileGrps } }
    : {};
}


// --- public: make <mets:amdSec> for images only ---
// --- public: make multiple <mets:amdSec>, one per image ---
function makeIssueAmdSec({ imageFiles = [] }) {
  if (!imageFiles.length) return {};

  const amdSecs = imageFiles.map((raw, idx) => {
    const img = normImg(raw);               // normalize strings -> objects
    const seq = idx + 1;

    // IMGPARAM00001 / IMGPARAM00001TECHMD
    const amdId = img.amdId || `IMGPARAM${String(seq).padStart(5, "0")}`;
    const techId = `${amdId}TECHMD`;

    // persist the amdId back to the original entry if it's an object
    if (raw && typeof raw === "object") {
      raw.amdId = amdId;
    }
    // also set on the normalized copy we’re using locally
    img.amdId = amdId;

    // build techMD
    const techMDNode = buildImageTechMD(img, seq)["mets:techMD"];
    techMDNode.$.ID = techId;

    return {
      "mets:amdSec": {
        $: { ID: amdId, xmlns: "http://www.loc.gov/METS/" },
        "mets:techMD": techMDNode,
      },
    };
  });

  // multiple <mets:amdSec> siblings
  return { "mets:amdSec": amdSecs.map(x => x["mets:amdSec"]) };
}

function formatLabel(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // JS months are 0-based
  const year = date.getFullYear();
  return `The Daily Princetonian ${day}.${month}.${year}`;
}

function buildRootAttrs({ issueDate }) {
  return {
    "xmlns:mets": "http://www.loc.gov/METS/",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "xmlns:mods": "http://www.loc.gov/mods/v3",
    "xmlns:mix": "http://www.loc.gov/mix/",
    "xsi:schemaLocation":
      "http://www.loc.gov/METS/ http://www.loc.gov/standards/mets/mets.xsd",
    TYPE: "Newspaper",
    LABEL: formatLabel(issueDate),
  };
}

function buildMetsHdr({ created = new Date(), agentName = "Automated Articles Issue Archiver", agentNote = "Version 1.0.0" }) {
  return {
    "mets:metsHdr": {
      $: {
        CREATEDATE: created.toISOString(),
        LASTMODDATE: created.toISOString(),
        RECORDSTATUS: "complete",
      },
      "mets:agent": [
        {
          $: { ROLE: "CREATOR", TYPE: "OTHER", OTHERTYPE: "SOFTWARE" },
          "mets:name": agentName,
          "mets:note": agentNote,
        },
      ],
    },
  };
}

function makeIssueDmdSec({ issueDate, volumeNumber, issueNumber, articles }) {
  // MODS namespace + date
  const modsNS = "http://www.loc.gov/mods/v3";
  const dmy = new Date(issueDate);

  // format like "Dec 03, 2015"
  const formattedDate = dmy.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  // Roman numerals for volume
  const toRoman = (num) => {
    const romans = [
      ["M",1000],["CM",900],["D",500],["CD",400],
      ["C",100],["XC",90],["L",50],["XL",40],
      ["X",10],["IX",9],["V",5],["IV",4],["I",1]
    ];
    let result = "";
    for (const [r, v] of romans) {
      while (num >= v) {
        result += r;
        num -= v;
      }
    }
    return result;
  };

  // Construct issue label automatically
  const issueLabel = `Vol. ${toRoman(volumeNumber)}, No. ${issueNumber} (${formattedDate})`;

  // Normalize captureArticle -> fields needed for MODS
  const normalizeArticle = (a) => {
    const pages = Array.isArray(a.pages) ? a.pages.slice().sort((x, y) => x - y) : [];
    const startPage = pages.length ? pages[0] : undefined;
    const endPage = pages.length ? pages[pages.length - 1] : startPage;

    if (startPage == null || endPage == null) {
      throw new Error(`Article "${a.title}" is missing pages[]; cannot derive start/end page.`);
    }

    return {
      id: a.id,                // may be undefined; we'll default later
      title: a.title,
      // subTitle not present in captureArticle; omit
      startPage,
      endPage,
      // url/content not used in current MODS mapping; keep internal if needed
    };
  };

  const normalizedArticles = articles.map(normalizeArticle);

  const issueMods = {
    "mods:mods": {
      $: {
        "xmlns:mods": modsNS,
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:xlink": "http://www.w3.org/1999/xlink",
        "xsi:schemaLocation": `${modsNS} http://www.loc.gov/standards/mods/v3/mods-3-3.xsd`,
        ID: "MODSMD_ISSUE1_TI1",
      },
      "mods:titleInfo": [
        {
          $: { ID: "MODSMD_PRINT_TI1" },
          "mods:nonSort": "The",
          "mods:title": "Daily Princetonian",
        },
      ],
      "mods:part": [
        {
          $: { type: "issue" },
          "mods:text": issueLabel, // e.g., "Vol. CXXXIX, No. 114 (Dec 03, 2015)"
          "mods:date": { $: { encoding: "iso8601" }, _: dmy.toISOString().slice(0, 10) },
          "mods:detail": [
            { $: { type: "volume", level: "1" }, "mods:number": String(volumeNumber) },
            { $: { type: "number", level: "2" }, "mods:number": String(issueNumber) },
          ],
        },
      ],
      "mods:relatedItem": [
        // host publication
        {
          $: { type: "host" },
          "mods:titleInfo": {
            "mods:nonSort": "The",
            "mods:title": "Daily Princetonian",
          },
        },
        // constituents (articles)
        ...normalizedArticles.map((a, i) => ({
          $: { type: "constituent", ID: a.id || `MODSMD_ARTICLE${i + 1}` },
          "mods:titleInfo": { "mods:title": a.title },
          "mods:part": {
            $: { type: "article" },
            "mods:extent": {
              $: { unit: "pages" },
              "mods:start": String(a.startPage),
              "mods:end": String(a.endPage),
              "mods:list":
                a.startPage === a.endPage
                  ? `p. ${a.startPage}`
                  : `p. ${a.startPage} - ${a.endPage}`,
            },
          },
        })),
      ],
    },
  };

  return {
    "mets:dmdSec": {
      $: { ID: "ISSUE_DESCRIPTION" },
      "mets:mdWrap": {
        $: { MDTYPE: "MODS" },
        "mets:xmlData": issueMods,
      },
    },
  };
}

export const generateMetsFile = ({ 
  articlesData, 
  issueDate, 
  dir, 
  downloadLocally = true,
  imageFiles,
  altoFiles
  }) => {
  
  const metsXmlObject = {
    "mets:mets": {
      $: buildRootAttrs({ issueDate }),
      ...buildMetsHdr({
        created: new Date(),
        agentName: "Automated Articles Issue Archiver",
        agentNote: "Version 1.0.0",
      }),
      ...makeIssueDmdSec({
        issueDate,
        volumeNumber: 147,
        issueNumber: 1,
        articles: articlesData,
      }),
      ...makeIssueAmdSec({ imageFiles }),
      ...makeIssueFileSec({
        images: imageFiles,
        alto: altoFiles,
      }),
      // (optional) keep/add your structMap here
    },
  };

  
/*
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
  };
  */

  const builder = new xml2js.Builder({ renderOpts: { pretty: true, indent: "  ", newline: "\n" } });
  const xmlString = builder.buildObject(metsXmlObject);
  if (downloadLocally && dir) {
    const path = `./documents/${dir}/`;
    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(path + "mets.xml", xmlString);
  }
  return {
    buffer: xmlString,
    name: "mets.xml",
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
