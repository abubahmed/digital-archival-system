import {
  dailyPrinceHandler,
  mergePDFBuffers,
} from "../handlers/dailyprince.mjs";

export const createTodaysArchive = async ({ event, callback, context }) => {
  // Taken from the Article Tracker apps script

  const today = new Date("April 12, 2024 12:01:00");
  // const today = new Date()
  const month =
    today.getMonth() + 1 < 10
      ? "0" + (today.getMonth() + 1)
      : today.getMonth().toString();
  const date = today.getDate().toString();
  const year = today.getFullYear().toString();

  const yesterday = new Date("April 11, 2024 12:01:00");
  // const yesterday = new Date(Date.now() - 86400000)
  const yestermonth =
    yesterday.getMonth() + 1 < 10
      ? "0" + (yesterday.getMonth() + 1)
      : yesterday.getMonth().toString();
  const yesterdate = yesterday.getDate().toString();
  const yesteryear = yesterday.getFullYear().toString();

  // Fetches all articles that were published after midnight yesterday and before midnight during today's prod night
  const req =
    await fetch(`https://www.dailyprincetonian.com/search.json?a=1&s=&ti=&ts_month=${yestermonth}
    &ts_day=${yesterdate}&ts_year=${yesteryear}&te_month=${month}&te_day=${date}&te_year=${year}
    &au=&tg=&ty=article&o=date`);
  const json = await req.json();

  let urlList = [];
  json["items"].forEach((item) => {
    urlList.push(`https://www.dailyprincetonian.com/${item["uuid"]}`);
  });

  dailyPrinceHandler({ event: { webUrls: urlList } });
};

createTodaysArchive({});
