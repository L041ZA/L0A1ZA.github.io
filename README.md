# Market Watch — Real-Time Observatory

A static personal portfolio site hosted on **GitHub Pages** with a built-in **Market Watch observatory** that tracks ~53 financial instruments across indices, ETFs, forex, commodities, and stocks — updated automatically via **GitHub Actions**.

## Architecture

```
GitHub Actions (cron)          GitHub Pages
┌──────────────────┐           ┌──────────────────┐
│ update_market_    │  commit   │  index.html      │
│ data.py           │ ───────► │  js/main.js       │
│                   │          │  css/styles.css   │
│ yfinance ─► JSON  │          │  data/*.js        │
│           ─► JS   │          │                   │
└──────────────────┘           └──────────────────┘
```

### Data Pipeline

`update_market_data.py` fetches market data using [yfinance](https://github.com/ranaroussi/yfinance) and outputs two files:

| File | Purpose |
|------|---------|
| `data/tickers_summary.json` | Structured JSON with price, change, volume, stats, and OHLC history for 4 periods (1D, 5D, 1M, 6M) |
| `data/tickers_data.js` | Same payload as a JS global variable (`MARKET_DATA`) for `file://` compatibility |

### Coverage (~53 instruments)

| Category | Examples |
|----------|----------|
| **Indices** | S&P 500, Dow Jones, Nasdaq, Russell 2000, VIX, FTSE 100, Nikkei 225, Euro Stoxx 50 |
| **ETFs** | SPY, QQQ, IWM, GLD, SLV, TLT, XLF, XLK, XLE |
| **Forex** | EUR/USD, GBP/USD, USD/JPY, USD/PEN, USD/MXN, USD/BRL, DXY |
| **Commodities** | Gold, Silver, WTI Crude, Brent, Natural Gas, Copper, Corn, Coffee |
| **Stocks** | AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, JPM, BTC-USD, BVN |

## Features

- **Ticker tape** — scrolling marquee with sparkline SVGs and threshold alerts (|chg| >= 5%)
- **Macro strip** — 6 key indicators (S&P 500, VIX, DXY, BTC, WTI, Gold) always visible
- **Detail view** — Yahoo Finance-style chart with price + volume overlay, period selector (1D / 5D / 1M / 6M), and full stats table
- **Comparator** — normalized % change overlay for any two tickers
- **Easter eggs** — witty notes on select tickers

## GitHub Actions — Automated Updates

The workflow at `.github/workflows/update_data.yml` runs the pipeline on a cron schedule:

```yaml
on:
  schedule:
    - cron: "0 * * * 1-5"   # Every hour, Mon–Fri (UTC)
  workflow_dispatch:          # Manual trigger
```

Each run:
1. Checks out the repo
2. Installs `yfinance` + `pandas`
3. Runs `python update_market_data.py`
4. Commits and pushes `data/tickers_summary.json` + `data/tickers_data.js`

GitHub Pages detects the push and serves the updated site.

### Estimated resource usage

| Metric | Value |
|--------|-------|
| Runs per day | ~12 (market hours) |
| Run duration | ~2–3 min |
| Monthly minutes | ~900 of 2,000 free (public repo = unlimited) |
| Data per commit | ~2 MB (JSON + JS) |

## Local Development

```bash
# Install dependencies
pip install yfinance pandas

# Fetch fresh data
python update_market_data.py

# Serve locally
python -m http.server 8080

# Open http://localhost:8080
```

Opening `index.html` directly (`file://`) also works thanks to the `data/tickers_data.js` inline bundle.

## Project Structure

```
.
├── index.html                 # Main page
├── css/
│   └── styles.css             # All styles (glassmorphism, animations)
├── js/
│   └── main.js                # Client logic (charts, search, tape, etc.)
├── data/
│   ├── tickers_summary.json   # Market data (generated)
│   └── tickers_data.js        # JS bundle (generated)
├── images/
│   └── lrandy.jpeg            # Profile photo
├── docs/
│   ├── CV_Luis_Randy_Loayza_ES.pdf
│   ├── CV_Randy_Loayza_EN.pdf
│   ├── ARTICULO_DE_ECONOMICA__Luis_Loayza.pdf
│   └── Ensayo_Julio_Velarde_Luis_Loayza.pdf
├── update_market_data.py      # Data pipeline script
├── .github/
│   └── workflows/
│       └── update_data.yml    # GitHub Actions cron workflow
└── .gitignore
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (custom properties, grid, glassmorphism), Vanilla JS |
| Charts | [Plotly.js](https://plotly.com/javascript/) |
| Background | [Three.js](https://threejs.org/) (aurora shader) |
| Data | [yfinance](https://github.com/ranaroussi/yfinance) (Python) |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## License

Personal portfolio — all rights reserved.
