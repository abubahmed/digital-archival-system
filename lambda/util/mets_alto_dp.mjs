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

export function makeLogicalStructMap({
  articles,                         // required: your articlesData [{ title, url?, pages:[...] }, ...]
  newspaperLabel,                   // e.g., "The Daily Princetonian no. 119 10.12.2015"
  issueDmdId = "MODSMD_ISSUE1",
  volumeDmdIds = ["MODSMD_PRINT", "MODSMD_ELEC"],
  firstPageAnchor = (p) => `tb_${p}_1`, // first page holds full text
  laterPageAnchor  = (p) => `page_${p}`, // later pages may be blank ALTO
}) {
  const pad5 = (n) => String(n).padStart(5, "0");

  // DIVL-style incremental IDs: DIVL1, DIVL2, ...
  let idCounter = 1;
  const nextId = () => `DIVL${idCounter++}`;

  // Build ARTICLE nodes inside a CONTENT container
  const articleDivs = (articles || []).map((art, i) => {
    const pages = (Array.isArray(art.pages) ? [...art.pages] : []).sort((a, b) => a - b);
    const areas = pages.map((p, idx) => ({
      $: {
        BETYPE: "IDREF",
        FILEID: `ALTO${pad5(p)}`,
        BEGIN: idx === 0 ? firstPageAnchor(p) : laterPageAnchor(p),
      },
    }));

    return {
      $: {
        ID: nextId(),
        TYPE: "ARTICLE",
        LABEL: art.title || `Article ${i + 1}`,
        DMDID: `MODSMD_ARTICLE${i + 1}`, // matches your makeIssueDmdSec; remove if undesired
      },
      ...(art.url
        ? { mptr: { $: { "xlink:href": art.url, "xmlns:xlink": "http://www.w3.org/1999/xlink" } } }
        : {}),
      // Minimal nesting: ARTICLE → BODY → BODY_CONTENT → TEXT → fptr(seq of ALTO areas)
      div: {
        $: { ID: nextId(), TYPE: "BODY" },
        div: {
          $: { ID: nextId(), TYPE: "BODY_CONTENT" },
          div: {
            $: { ID: nextId(), TYPE: "TEXT" },
            fptr: { seq: { area: areas } },
          },
        },
      },
    };
  });

  // CONTENT container holding the articles
  const contentDiv = {
    $: { ID: nextId(), TYPE: "CONTENT" },
    div: articleDivs,
  };

  // ISSUE (no title section), then VOLUME, then Newspaper
  const issueDiv = {
    $: {
      ID: nextId(),
      TYPE: "ISSUE",
      DMDID: issueDmdId,
      LABEL: newspaperLabel || "Issue",
    },
    div: contentDiv,
  };

  const volumeDiv = {
    $: {
      ID: nextId(),
      TYPE: "VOLUME",
      DMDID: (volumeDmdIds || []).join(" "),
      LABEL: newspaperLabel || "Volume",
    },
    div: issueDiv,
  };

  const newspaperDiv = {
    $: {
      ID: nextId(),
      TYPE: "Newspaper",
      LABEL: newspaperLabel || "Newspaper",
    },
    div: volumeDiv,
  };

  // Return LOGICAL structMap only (combine with your PHYSICAL elsewhere)
  return {
    structMap: {
      $: { LABEL: "Logical Structure", TYPE: "LOGICAL", xmlns: "http://www.loc.gov/METS/" },
      div: newspaperDiv,
    },
  };
}

function makePhysicalStructMap({
  numPages,
  rootLabel = "Physical Structure",
  newspaperLabel = "The Daily Princetonian",
  newspaperType = "Newspaper",
  dmdIds = ["MODSMD_PRINT", "MODSMD_ELEC"],
}) {
  if (!Number.isInteger(numPages) || numPages < 1) return {};

  const pad5 = (n) => String(n).padStart(5, "0");

  const pageDivs = [];
  for (let p = 1; p <= numPages; p++) {
    const divId = `DIVP${p + 1}`;
    const attrs = {
      ID: divId,
      ORDER: String(p),
      ORDERLABEL: String(p),
      TYPE: "PAGE",
    };
    if (p > 1) attrs.LABEL = String(p);

    pageDivs.push({
      $: attrs,
      fptr: {
        par: {
          area: [
            { $: { FILEID: `IMG${pad5(p)}` } },
            // Anchor to the ALTO Page ID you generate: ID="page_${p}"
            { $: { FILEID: `ALTO${pad5(p)}`, BETYPE: "IDREF", BEGIN: `page_${p}` } },
          ],
        },
      },
    });
  }

  return {
    structMap: {
      $: { LABEL: rootLabel, TYPE: "PHYSICAL", xmlns: "http://www.loc.gov/METS/" },
      div: {
        $: {
          ID: "DIVP1",
          LABEL: newspaperLabel,
          TYPE: newspaperType,
          ...(dmdIds?.length ? { DMDID: dmdIds.join(" ") } : {}),
        },
        div: pageDivs,
      },
    },
  };
}

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

function formatLabel(date, issueNumber) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // JS months are 0-based
  const year = date.getFullYear();
  return `The Daily Princetonian no. ${issueNumber} ${day}.${month}.${year}`;
}

function buildRootAttrs({ issueDate, issueNumber }) {
  return {
    "xmlns:mets": "http://www.loc.gov/METS/",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "xmlns:mods": "http://www.loc.gov/mods/v3",
    "xmlns:mix": "http://www.loc.gov/mix/",
    "xsi:schemaLocation":
      "http://www.loc.gov/METS/ http://www.loc.gov/standards/mets/mets.xsd",
    TYPE: "Newspaper",
    LABEL: formatLabel(issueDate, issueNumber),
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
  altoFiles,
  issueNumber,
  volumeNumber
  }) => {

  const phys = makePhysicalStructMap({
    numPages: imageFiles?.length
  });

  const logical = makeLogicalStructMap({
    articles: articlesData,
    newspaperLabel: formatLabel(issueDate, issueNumber),
  });
  
  const metsXmlObject = {
    "mets:mets": {
      $: buildRootAttrs({ issueDate, issueNumber }),
      ...buildMetsHdr({
        created: new Date(),
        agentName: "Automated Articles Issue Archiver",
        agentNote: "Version 1.0.0",
      }),
      ...makeIssueDmdSec({
        issueDate,
        volumeNumber,
        issueNumber,
        articles: articlesData,
      }),
      ...makeIssueAmdSec({ imageFiles }),
      ...makeIssueFileSec({
        images: imageFiles,
        alto: altoFiles,
      }),
      "mets:structMap": [
        phys.structMap,    // PHYSICAL
        logical.structMap, // LOGICAL
      ],
    },
  };

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
