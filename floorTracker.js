// floorTracker.js

const { PrismaClient } = require("@prisma/client");
const getFloorMagicEden = require("./Fetchers/magiceden");

const { Client, ChannelType } = require("discord.js");

const prisma = new PrismaClient();

/**
 * Map of marketplace fetchers (extendable in future)
 */
const fetchers = {
  magiceden: getFloorMagicEden,
  // opensea: getFloorOpenSea,
};

/**
 * Starts the recurring job to track floor prices.
 * @param {Client} client - The Discord.js client.
 */
async function startFloorTracker(client) {
  setInterval(async () => {
    console.log("[Tracker] Checking floor prices...");

    let collections;
    try {
      collections = await prisma.collection.findMany();
    } catch (err) {
      console.error("[Tracker] Failed to fetch collections:", err);
      return;
    }

    if (collections.length === 0) {
      console.log("[Tracker] No collections to track.");
      return;
    }

    for (const collection of collections) {
      const { slug, chain, marketplace, channel, lastFloorPrice, name } = collection;

      const fetchFloor = fetchers[marketplace];
      if (!fetchFloor) {
        console.log(`[Tracker] Skipping unsupported marketplace: ${marketplace}`);
        continue;
      }

      try {
        const result = await fetchFloor(slug, chain);
        if (!result) {
          console.log(`[Tracker] No data for ${name}`);
          continue;
        }

        const currentFloor = result.floorPrice;
        if (lastFloorPrice !== null && currentFloor === lastFloorPrice) {
          continue; // No change
        }

        const thread = await client.channels.fetch(channel).catch(() => null);
        if (!thread || thread.type !== ChannelType.PublicThread) {
          console.log(`[Tracker] Invalid or inaccessible thread for ${name}`);
          continue;
        }

        await thread.send(
          `📊 Floor price for **${name}** updated:\n` +
          `**${lastFloorPrice ?? "N/A"} → ${currentFloor} ${chain.toUpperCase()}**\n` +
          `(Listed: ${result.listedCount})`
        );

        await prisma.collection.update({
          where: { id: collection.id },
          data: { lastFloorPrice: currentFloor },
        });

        console.log(`[Tracker] Updated floor for ${name}: ${currentFloor}`);
      } catch (err) {
        console.error(`[Tracker] Error tracking ${name}:`, err);
      }
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

module.exports = { startFloorTracker };
