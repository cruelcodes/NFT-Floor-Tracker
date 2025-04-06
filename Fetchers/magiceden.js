const fetch = (...args) => import("node-fetch").then(mod => mod.default(...args));

async function getFloorMagicEden(slug, chain) {
  try {
    const url = `https://api-mainnet.magiceden.dev/v2/collections/${slug}/stats?chain=${chain}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Magic Eden API error: ${res.statusText}`);

    const data = await res.json();

    const isSolana = chain.toLowerCase() === "solana";
    const divisor = isSolana ? 1e9 : 1;

    return {
      floorPrice: data.floorPrice != null ? data.floorPrice / divisor : null,
      listedCount: data.listedCount ?? null,
      avgPrice24hr: data.avgPrice24hr != null ? data.avgPrice24hr / divisor : null,
      volumeAll: data.volumeAll != null ? data.volumeAll / divisor : null
    };
  } catch (err) {
    console.error(`Failed to fetch floor from Magic Eden: ${err.message}`);
    return null;
  }
}

module.exports = getFloorMagicEden;
