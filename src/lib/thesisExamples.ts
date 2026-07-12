// Tailored ghost-text example for the onboarding "why are you interested?" step — specific to the
// asset the user is writing about (curated one-liners for well-known names; a name-personalized
// fallback for anything else), so the placeholder never reads generically.

const EXAMPLES: Record<string, string> = {
  NVDA: "AI datacenter demand keeps GPU orders growing faster than supply can catch up.",
  TSLA: "Robotaxi and energy storage grow into something bigger than the car business.",
  AAPL: "A loyal installed base plus services keep pricing power and margins climbing.",
  AMZN: "AWS and advertising carry the margins while retail throws off cash.",
  MSFT: "Copilot and Azure turn the enterprise base into recurring AI revenue.",
  GOOGL: "Search profits fund a winning hand in AI and cloud.",
  META: "AI-driven ad targeting keeps engagement and ad pricing climbing.",
  AMD: "Data-center GPUs take real share from the incumbent.",
  PLTR: "Commercial AIP adoption compounds well beyond the government base.",
  COIN: "Crypto keeps going mainstream and Coinbase is the regulated on-ramp.",
  AVGO: "Custom AI silicon and VMware make it a compounding cash machine.",
  MSTR: "It's a leveraged, long-term bet on the price of bitcoin.",
  HOOD: "Younger investors keep consolidating their money onto the platform.",
  NFLX: "Ads and paid sharing re-accelerate profit growth.",
  DIS: "Streaming turns profitable while the parks stay a cash engine.",
  COST: "Membership loyalty and pricing power compound slowly and safely.",
  WMT: "E-commerce and advertising lift margins on top of massive scale.",
  JPM: "The best-run big bank keeps taking share through every cycle.",
  V: "The shift from cash to cards keeps the toll-booth network growing.",
  MA: "Global card-payment volumes keep compounding for years.",
  LLY: "Demand for GLP-1 drugs outruns supply well into the future.",
  UNH: "Scale in insurance plus Optum keeps earnings compounding.",
  PYPL: "Branded checkout stabilizes and margins recover.",
  F: "EVs and software finally turn the legacy automaker around.",
  GM: "EV scale and autonomy optionality re-rate the stock.",
  RIVN: "It becomes the credible number-two American EV maker.",
  INTC: "The foundry turnaround restores its manufacturing lead.",
  MU: "AI memory demand drives a long, durable up-cycle.",
  QCOM: "It diversifies beyond phones into auto and IoT.",
  ORCL: "Cloud infrastructure and AI workloads reignite growth.",
  CRM: "AI agents expand seats and pricing across the customer base.",
  ADBE: "Creative and AI tools keep subscription growth intact.",
  CSCO: "AI networking demand revives hardware growth.",
  TXN: "Analog chips and new fabs compound free cash flow.",
  ARM: "Its architecture taxes nearly every new AI and mobile chip.",
  HD: "Housing demand and pro customers drive durable growth.",
  NKE: "The brand and a direct-to-consumer push restore margins.",
  SBUX: "A turnaround restores traffic and store economics.",
  MCD: "Value menus and franchising compound through any economy.",
  BAC: "The rate cycle and scale lift its earnings power.",
  GS: "A rebound in dealmaking and trading lifts returns.",
  JNJ: "Diversified healthcare compounds steadily through any cycle.",
  PFE: "The pipeline replaces the fading COVID revenue.",
  XOM: "Disciplined capital returns cash through the energy cycle.",
  CVX: "Low-cost barrels fund a steadily growing dividend.",
  SPY: "The U.S. market keeps compounding over the long run.",
  QQQ: "Big-tech leadership keeps carrying the market higher.",
  VOO: "Owning the entire U.S. market is the winning default.",
};

export function exampleThesis(ticker?: string, name?: string): string {
  const t = (ticker || "").trim().toUpperCase();
  if (EXAMPLES[t]) return `e.g. ${EXAMPLES[t]}`;
  const n = (name || t || "this company").trim();
  return `e.g. why you believe ${n} keeps winning as its market grows.`;
}
