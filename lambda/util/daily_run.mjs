import {
  dailyPrinceHandler,
  mergePDFBuffers,
} from "../handlers/dailyprince.mjs";
import he from "he";

export const createTodaysArchive = async ({ event, callback, context } = { event: {} }) => {
  const { day, month, year } = event || {};

  // Build "today" from inputs at 15:00:00 local time (no timezone string)
  const today = (() => {
      return new Date(year, month - 1, day, 15, 0, 0, 0); // month is 0-indexed
  })();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const yestermonth =
    yesterday.getMonth() + 1 < 10
      ? "0" + (yesterday.getMonth() + 1)
      : (yesterday.getMonth() + 1).toString();
  const yesterdate = yesterday.getDate().toString();
  const yesteryear = yesterday.getFullYear().toString();

  const tomormonth =
    tomorrow.getMonth() + 1 < 10
      ? "0" + (tomorrow.getMonth() + 1)
      : (tomorrow.getMonth() + 1).toString();
  const tomordate = tomorrow.getDate().toString();
  const tomoryear = tomorrow.getFullYear().toString();

  // Function to fetch a specific page
  async function fetchPage(pageNum) {
    const apiUrl = `https://www.dailyprincetonian.com/search.json?a=1&s=&ti=&ts_month=${yestermonth}&ts_day=${yesterdate}&ts_year=${yesteryear}&te_month=${tomormonth}&te_day=${tomordate}&te_year=${tomoryear}&au=&tg=&ty=article&o=date&page=${pageNum}`;
    
    // Print URL only for the first page
    if (pageNum === 1) {
      console.log('\nFetching articles from:');
      console.log(apiUrl);
      console.log(`Time range: ${yestermonth}/${yesterdate}/${yesteryear} to ${tomormonth}/${tomordate}/${tomoryear}\n`);
    }
    
    const req = await fetch(apiUrl);
    const json = await req.json();
    return json;
  }

  // Fetch first page to get pagination info
  const firstPageJson = await fetchPage(1);
  const totalPages = firstPageJson.pagination.total;
  
  // Collect all items
  let allItems = [...firstPageJson.items];
  
  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageJson = await fetchPage(page);
    allItems = [...allItems, ...pageJson.items];
  }

  let regularUrls = [];
  let regularTagCounts = {};
  
  allItems.forEach((item) => {
    // Check if item has metadata and if any metadata has label "promo_url"
    const hasPromoUrl = item.metadata && item.metadata.some(meta => meta.label === "promo_url");
    const url = `https://www.dailyprincetonian.com/${item["uuid"]}`;
    const published = new Date(item.published_at);

    // Only count tags for regular articles
    if (!hasPromoUrl && item.tags) {
      item.tags.forEach(tag => {
        regularTagCounts[tag.name] = (regularTagCounts[tag.name] || 0) + 1;
      });
    }

    if (published >= yesterday && published < today) {
      // Grab headline and plain-text content (naive strip)
      const headline = stripHtml(item.headline);
      const contentHtml = item.content || item.body || "";
      const content = stripHtml(contentHtml);

      if (!hasPromoUrl) {
        regularUrls.push({ url, headline, tags: item.tags, content });
      }
    }
  });

  // Categorize regular articles by primary tags
  const primaryTags = ['letter-from-the-editor', 'news', 'Analysis', 'Opinion', 'Sports', 'Features', 'data', 'Prospect', 'visual essay', 'other', 'Humor'];
  const categorizedArticles = {
    'letter-from-the-editor': [],
    news: [],
    Analysis: [],
    Opinion: [],
    Sports: [],
    Features: [],
    data: [],
    Prospect: [],
    'visual essay': [],
    other: [],
    Humor: []
  };

  regularUrls.forEach(item => {
    let categorized = false;
    // Check tags in priority order
    for (const primaryTag of primaryTags) {
      if (!categorized && item.tags && item.tags.some(t => t.name === primaryTag)) {
        categorizedArticles[primaryTag].push(item);
        categorized = true;
        break;
      }
    }
    // If article doesn't match any primary tag, put in 'other'
    if (!categorized) {
      categorizedArticles.other.push(item);
    }
  });

  // Create ordered list including title + content
  let orderedUrls = [];
  
  // Add articles in priority order
  for (const category of primaryTags) {
    const articles = categorizedArticles[category];
    if (articles.length > 0) {
      articles.forEach(item => {
        orderedUrls.push({
          url: item.url,
          category: category,
          headline: item.headline,
          content: item.content
        });
      });
    }
  }

  // Print ordered URLs with minimal info
  console.log('\nOrdered Articles:');
  orderedUrls.forEach((item, index) => {
    console.log(`${index + 1}. [${item.category}] ${item.url}`);
  });

  // Set up for handler use
  regularUrls = orderedUrls;
  
  // Pass articles to handler and return its result
  const result = await dailyPrinceHandler({ 
    event: { 
      today,
      articles: orderedUrls.map(({ url, headline, content }) => ({
        url,
        title: headline,
        content
      }))
    } 
  });

  // Print a summary of the results instead of the full object with base64 data
  console.log('\nArchive Generation Results:');
  console.log(`Issue Name: ${result.issueName}`);
  console.log(`Issue Date: ${result.issueDate}`);
  console.log('\nArtifacts generated:');
  console.log(`- PDF: ${result.artifacts.pdf.name}`);
  console.log(`- METS: ${result.artifacts.mets.name}`);
  console.log(`- ALTO files: ${result.artifacts.alto.length} files`);
  
  return result;
};

export function stripHtml(html = "") {
  let s = he.decode(html);

  // 1. Convert block-level tags to a space
  s = s.replace(/<\/?(p|div|br|li|section|tr|h[1-6])[^>]*>/gi, " ");

  // 2. Remove all other tags completely (no space)
  s = s.replace(/<[^>]*>/g, "");

  // 3. Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // 4. Escape for XML attribute
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

//createTodaysArchive({});
