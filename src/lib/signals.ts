export const SIGNAL_LABELS: Record<string, string> = {
  polymarket: "Polymarket (prediction markets)",
  kalshi: "Kalshi (event markets)",
  metaculus: "Metaculus (forecasts)",
  manifold: "Manifold (forecasts)",
  google_trends: "Google Trends (search demand)",
  wikipedia_pageviews: "Wikipedia (attention)",
  hacker_news: "Hacker News (developer sentiment)",
  reddit: "Reddit (retail sentiment)",
  stocktwits: "StockTwits (retail sentiment)",
  github: "GitHub (developer adoption)",
  job_postings: "Job postings (hiring intent)",
  web_traffic: "Web traffic (product usage)",
  app_rankings: "App rankings (consumer demand)",
  onchain_smart_money: "On-chain smart money",
  exchange_flows: "Exchange flows",
  options_flow: "Unusual options activity",
  short_interest: "Short interest",
  commodity_price: "Commodity price",
  sec_edgar: "SEC filings",
  earnings: "Earnings & transcripts",
  fred: "FRED (macro data)",
  price_volume: "Price & volume",
  news: "News",
  sector_official: "Sector data",
};

export function labelFor(id: string): string {
  return SIGNAL_LABELS[id] || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
