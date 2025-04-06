const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function getFloorOpenSea(slug) {
  const url = `https://api.opensea.io/api/v2/collections/${slug}/stats`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-api-key": process.env.OPENSEA_API_KEY,
      },
    });

    if (!res.ok) throw new Error(`OpenSea API error: ${res.statusText}`);

    const data = await res.json();
    console.log("📦 OpenSea Stats Response:", data);

    return {
      floorPrice: data.total?.floor_price ?? null,
      listedCount: null,
      total: data.total ?? null,
      intervals: data.intervals ?? [],
    };

  } catch (err) {
    console.error(`Failed to fetch floor from OpenSea: ${err.message}`);
    return {
      floorPrice: null,
      listedCount: null,
      total: null,
      intervals: [],
    };
  }
}

module.exports = getFloorOpenSea;
