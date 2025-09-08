// server.js
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// servir index.html
app.use(express.static(path.join(__dirname, "public")));

// endpoint de cotizaciones
app.get("/api/prices", async (req, res) => {
  try {
    const url = "https://criptoya.com/api/btc/ars/1"; // BTC/ARS de muchos exchanges
    const resp = await fetch(url);
    const data = await resp.json();

    // ejemplo de exchanges
    const exchanges = [
      "belo", "binance", "binancep2p", "paxfulp2p",
      "pluscrypto", "ripio", "ripioexchange", "saldo",
      "satoshitango", "tiendacrypto", "trubit",
      "universalcoins", "vitawallet"
    ];

    // precio de referencia en USD
    const usdResp = await fetch("https://criptoya.com/api/btc/usd/1");
    const usdData = await usdResp.json();
    const usdPrice = usdData.binance.price; // referencia binance USD

    const result = exchanges.map(ex => ({
      name: ex.toUpperCase(),
      ars: data[ex]?.ask || 0,
      usd: usdPrice
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
