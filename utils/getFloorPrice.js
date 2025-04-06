const getFloorOpenSea = require("../Fetchers/opensea");

async function getFloorMagicEden(slug, chain) {
  try {
    if (chain === "solana") {
      const res = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${slug}/stats`);
      const data = await res.json();
      return data.floorPrice ? data.floorPrice / 1e9 : null;
    } else {
      const res = await fetch(`https://api-mainnet.magiceden.dev/v2/evm/collections/${slug}/stats?chain=${chain}`);
      const data = await res.json();
      return data.floorPrice || null;
    }
  } catch (err) {
    console.error(`❌ Failed to fetch floor price for ${slug} on ${chain}:`, err);
    return null;
  }
}

async function getFloorPrice(slug, chain, marketplace) {
  if (marketplace === "magiceden") {
    return await getFloorMagicEden(slug, chain);
  } else if (marketplace === "opensea") {
    return await getFloorOpenSea(slug, chain);
  } else {
    console.warn(`⚠️ Unsupported marketplace: ${marketplace}`);
    return null;
  }
}

module.exports = getFloorPrice;
