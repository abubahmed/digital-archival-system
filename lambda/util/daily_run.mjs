import {
  dailyPrinceHandler,
  mergePDFBuffers,
} from "../handlers/dailyprince.mjs";

export const createTodaysArchive = async ({ event, callback, context }) => {
  // Taken from the Article Tracker apps script

  const today = new Date("April 11, 2023 15:00:00");

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  //const yesterday = new Date("November 7, 2023 10:00:00");
  // const yesterday = new Date(Date.now() - 86400000)
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
  for(let page = 2; page <= totalPages; page++) {
    const pageJson = await fetchPage(page);
    allItems = [...allItems, ...pageJson.items];
  }

  let regularUrls = [];
  let promoUrls = [];
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
      if (!hasPromoUrl) {
        regularUrls.push({ url, headline: item.headline, tags: item.tags });
      } else {
        promoUrls.push({ url, headline: item.headline, tags: item.tags });
      }
    }
    else{

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

  // Create ordered list of URLs
  let orderedUrls = [];
  
  // Add articles in priority order
  for (const category of primaryTags) {
    const articles = categorizedArticles[category];
    if (articles.length > 0) {
      articles.forEach(item => {
        orderedUrls.push({
          url: item.url,
          category: category,
          headline: item.headline
        });
      });
    }
  }

  // Print ordered URLs with minimal info
  console.log('\nOrdered Articles:');
  orderedUrls.forEach((item, index) => {
    console.log(`${index + 1}. [${item.category}] ${item.url}`);
  });

  if (promoUrls.length > 0) {
    console.log('\nFiltered Promo URLs:');
    promoUrls.forEach(item => console.log(item.url));
  }

  console.log(`\nTotal: ${orderedUrls.length} articles (${promoUrls.length} promos filtered)`);
  
  // Set up for handler use
  regularUrls = orderedUrls;
  
  // Commented out handler
  dailyPrinceHandler({ event: { webUrls: orderedUrls.map(item => item.url) } });
};

createTodaysArchive({});
