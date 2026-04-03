"""
update_market_data.py
Pipeline — fetches ~53 tickers with intraday/daily history (1D, 5D, 1M, 6M)
plus valuation ratios and key stats. Outputs JSON for the Yahoo Finance–style
detail view. Runs hourly via GitHub Actions.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

OUTPUT_DIR = Path(__file__).resolve().parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "tickers_summary.json"

TICKERS = {
    "indices": [
        ("^GSPC",     "S&P 500"),
        ("^DJI",      "Dow Jones"),
        ("^IXIC",     "Nasdaq"),
        ("^RUT",      "Russell 2000"),
        ("^VIX",      "VIX"),
        ("^FTSE",     "FTSE 100"),
        ("^N225",     "Nikkei 225"),
        ("^STOXX50E", "Euro Stoxx 50"),
    ],
    "etfs": [
        ("SPY", "SPDR S&P 500"),  ("QQQ", "Invesco QQQ"),
        ("IWM", "iShares Russell 2000"), ("EEM", "iShares MSCI EM"),
        ("VTI", "Vanguard Total Market"), ("VOO", "Vanguard S&P 500"),
        ("DIA", "SPDR Dow Jones"), ("GLD", "SPDR Gold"),
        ("SLV", "iShares Silver"), ("TLT", "iShares 20+ Yr Treasury"),
        ("XLF", "Financial Select SPDR"), ("XLK", "Technology Select SPDR"),
        ("XLE", "Energy Select SPDR"),
    ],
    "forex": [
        ("DX-Y.NYB", "US Dollar Index"),
        ("EURUSD=X","EUR/USD"), ("GBPUSD=X","GBP/USD"),
        ("USDJPY=X","USD/JPY"), ("USDCHF=X","USD/CHF"),
        ("AUDUSD=X","AUD/USD"), ("USDCAD=X","USD/CAD"),
        ("PEN=X","USD/PEN"),    ("USDMXN=X","USD/MXN"),
        ("USDCOP=X","USD/COP"), ("USDBRL=X","USD/BRL"),
        ("USDCLP=X","USD/CLP"),
    ],
    "commodities": [
        ("GC=F","Gold"),    ("SI=F","Silver"),
        ("CL=F","WTI Crude"),("BZ=F","Brent Crude"),
        ("NG=F","Natural Gas"),("HG=F","Copper"),
        ("ZC=F","Corn"),    ("ZS=F","Soybeans"),
        ("ZW=F","Wheat"),   ("KC=F","Coffee"),
    ],
    "stocks": [
        ("BTC-USD", "Bitcoin"),
        ("AAPL","Apple"),   ("MSFT","Microsoft"),
        ("GOOGL","Alphabet"),("AMZN","Amazon"),
        ("NVDA","NVIDIA"),  ("TSLA","Tesla"),
        ("META","Meta"),    ("JPM","JPMorgan"),
        ("BVN","Buenaventura"),
    ],
}

PERIODS = [
    ("1d",  "5m"),
    ("5d",  "30m"),
    ("1mo", "1d"),
    ("6mo", "1d"),
]


def fmt_num(n):
    if n is None: return None
    if n >= 1e12: return f"{n/1e12:.2f}T"
    if n >= 1e9:  return f"{n/1e9:.2f}B"
    if n >= 1e6:  return f"{n/1e6:.1f}M"
    if n >= 1e3:  return f"{n/1e3:.1f}K"
    return str(round(n))


def safe(info, key):
    v = info.get(key)
    if v is None or v == "Infinity" or v == "NaN": return None
    try: return float(v)
    except (ValueError, TypeError): return None


def fetch_periods(tk):
    result = {}
    for period, interval in PERIODS:
        try:
            h = tk.history(period=period, interval=interval)
            if h.empty: continue
            h = h.reset_index()
            col = "Datetime" if "Datetime" in h.columns else "Date"
            if period == "1d":
                labels = h[col].dt.strftime("%H:%M").tolist()
            elif interval in ("30m", "1h"):
                labels = h[col].dt.strftime("%m/%d %H:%M").tolist()
            else:
                labels = h[col].dt.strftime("%Y-%m-%d").tolist()
            closes = [round(float(c), 4 if float(c) < 10 else 2) for c in h["Close"]]
            vols = []
            if "Volume" in h.columns:
                for raw in h["Volume"]:
                    try:
                        x = float(raw)
                        vols.append(int(round(x)) if x == x and x >= 0 else 0)
                    except (TypeError, ValueError):
                        vols.append(0)
            else:
                vols = [0] * len(closes)
            if len(vols) != len(closes):
                vols = [0] * len(closes)
            result[period] = {"t": labels, "v": closes, "vol": vols}
        except Exception:
            pass
    return result


def fetch_one(symbol, name, category):
    try:
        tk = yf.Ticker(symbol)
        info = {}
        try: info = tk.info or {}
        except Exception: pass

        periods = fetch_periods(tk)
        if not periods: return None

        best = periods.get("1mo") or periods.get("5d") or periods.get("1d")
        price = best["v"][-1] if best else None
        if price is None: return None

        prev = best["v"][-2] if len(best["v"]) >= 2 else price
        chg_abs = round(price - prev, 4 if price < 10 else 2)
        chg_pct = round(((price - prev) / prev) * 100, 2) if prev else 0

        mc = safe(info, "marketCap")
        av = safe(info, "averageVolume")

        return {
            "symbol": symbol, "name": name, "cat": category,
            "price": price,
            "chg": chg_pct,
            "chg_abs": chg_abs,
            "prev_close": round(safe(info, "previousClose") or prev, 2),
            "open": round(safe(info, "open") or price, 2),
            "day_high": round(safe(info, "dayHigh") or price, 2),
            "day_low": round(safe(info, "dayLow") or price, 2),
            "vol": fmt_num(safe(info, "volume")),
            "avg_vol": fmt_num(av),
            "mkt_cap": fmt_num(mc),
            "pe": round(safe(info, "trailingPE"), 2) if safe(info, "trailingPE") else None,
            "fwd_pe": round(safe(info, "forwardPE"), 2) if safe(info, "forwardPE") else None,
            "pb": round(safe(info, "priceToBook"), 2) if safe(info, "priceToBook") else None,
            "eps": round(safe(info, "trailingEps"), 2) if safe(info, "trailingEps") else None,
            "beta": round(safe(info, "beta"), 2) if safe(info, "beta") else None,
            "div_yield": round(safe(info, "dividendYield") * 100, 2) if safe(info, "dividendYield") else None,
            "high52": round(safe(info, "fiftyTwoWeekHigh"), 2) if safe(info, "fiftyTwoWeekHigh") else None,
            "low52": round(safe(info, "fiftyTwoWeekLow"), 2) if safe(info, "fiftyTwoWeekLow") else None,
            "periods": periods,
        }
    except Exception as exc:
        print(f"  [WARN] {symbol}: {exc}")
        return None


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for category, pairs in TICKERS.items():
        print(f"\n-- {category.upper()} --")
        for symbol, lbl in pairs:
            print(f"  {symbol}...", end=" ")
            row = fetch_one(symbol, lbl, category)
            if row:
                results.append(row)
                print(f"${row['price']} ({row['chg']:+.2f}%)")
            else:
                print("no data")

    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "default": "GOOGL",
        "tickers": results,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    js_file = OUTPUT_DIR / "tickers_data.js"
    with open(js_file, "w", encoding="utf-8") as f:
        f.write("var MARKET_DATA = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")

    print(f"\nSaved {len(results)} tickers to {OUTPUT_FILE}")
    print(f"JS bundle: {js_file}")


if __name__ == "__main__":
    main()
