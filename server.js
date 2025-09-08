// server.js
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// —— Helpers ——
async function safeJSON(url) {
  try {
    const r = await fetch(url, { timeout: 12000 });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("fetch fail:", url, e.message);
    return null;
  }
}

// dólar blue: override por query/env; si no, intenta criptoya
async function getDollarBlue({ override }) {
  if (override && !isNaN(+override)) return +override;
  if (process.env.USD_ARS_OVERRIDE && !isNaN(+process.env.USD_ARS_OVERRIDE)) {
    return +process.env.USD_ARS_OVERRIDE;
  }
  const cj = await safeJSON("https://criptoya.com/api/dolar");
  if (cj?.blue?.ask) return +cj.blue.ask;
  return 0;
}

// —— Static ——
app.use(express.static(path.join(__dirname, "public")));

// —— Health (Render: /health) ——
app.get("/health", (_req, res) => res.status(200).send("ok"));

// —— API ——
// /api/prices?mode=blue|btc&blue=1180
app.get("/api/prices", async (req, res) => {
  try {
    const mode = (req.query.mode || "blue").toLowerCase(); // default: blue
    const blueOverride = req.query.blue;

    // BTC/ARS (exchanges en ARS)
    const arsData = await safeJSON("https://criptoya.com/api/btc/ars/1");
    if (!arsData) return res.status(502).json({ error: "ARS feed error" });

    // BTC/USD (exchanges en USD) — solo si se usa modo btc
    let usdMap = null;
    if (mode === "btc") {
      usdMap = await safeJSON("https://criptoya.com/api/btc/usd/1");
      if (!usdMap) return res.status(502).json({ error: "USD feed error" });
    }

    // Lista de exchanges a mostrar (en minúscula porque así viene la API)
    const exchanges = [
      "belo",
      "binance",
      "binancep2p",
      "paxfulp2p",
      "pluscrypto",
      "ripio",
      "ripioexchange",
      "saldo",
      "satoshitango",
      "tiendacrypto",
      "trubit",
      "universalcoins",
      "vitawallet"
    ];

    // Para modo blue, buscamos una sola vez
    let blueRate = 0;
    if (mode === "blue") {
      blueRate = await getDollarBlue({ override: blueOverride });
      if (!blueRate || blueRate <= 0) {
        return res.status(502).json({
          error:
            "No se pudo obtener dólar blue; use ?blue=<valor> o la env USD_ARS_OVERRIDE"
        });
      }
    }

    const result = exchanges.map((ex) => {
      const exArs = arsData?.[ex]?.ask ?? 0;
      let usd = 0;
      let usd_source = "";

      if (mode === "blue") {
        usd = exArs && blueRate ? exArs / blueRate : 0;
        usd_source = `blue:${blueRate}`;
      } else {
        const refUsd = usdMap?.[ex]?.price ?? usdMap?.binance?.price ?? 0;
        usd = exArs && refUsd ? exArs / refUsd : 0;
        usd_source = `btc_usd:${usdMap?.[ex]?.price ? ex : "binance"}`;
      }

      return {
        name: ex.toUpperCase(),
        ars: exArs,
        usd,
        usd_source,
        ts: Date.now(),
      };
    });

    res.json({ mode, count: result.length, result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
