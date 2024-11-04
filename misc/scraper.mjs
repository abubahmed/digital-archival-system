import { ApifyClient } from "apify-client";

// Initialize the ApifyClient with your Apify API token
// Replace the '<YOUR_API_TOKEN>' with your token
const client = new ApifyClient({
  token: "<YOUR_API_TOKEN>",
});

// Prepare Actor input
const input = {
  addParentData: false,
  directUrls: ["https://www.instagram.com/dailyprincetonian/"],
  enhanceUserSearchWithFacebookPage: false,
  isUserReelFeedURL: false,
  isUserTaggedFeedURL: false,
  resultsLimit: 10,
  resultsType: "posts",
  searchLimit: 1,
  searchType: "hashtag",
};

// Run the Actor and wait for it to finish
const run = await client.actor("apify/instagram-scraper").call(input);

// Fetch and print Actor results from the run's dataset (if any)
console.log("Results from dataset");
console.log(
  `💾 Check your data here: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`
);
const { items } = await client.dataset(run.defaultDatasetId).listItems();
items.forEach((item) => {
  console.dir(item);
});

// 📚 Want to learn more 📖? Go to → https://docs.apify.com/api/client/js/docs
