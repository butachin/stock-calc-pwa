export default async function handler(req, res) {
  const { symbol = '7011.T', interval = '1m', range = '1d' } = req.query || {};

  // Normalize 4-digit Japanese stock code (e.g. "7011" -> "7011.T")
  const cleanSymbol = String(symbol).trim().toUpperCase();
  const yahooSymbol =
    /^\d{4}$/.test(cleanSymbol) || /^\d{3}[A-Z]$/.test(cleanSymbol)
      ? `${cleanSymbol}.T`
      : cleanSymbol;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(
    range
  )}&includePrePost=false`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Yahoo Finance API returned ${response.status}`,
      });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
