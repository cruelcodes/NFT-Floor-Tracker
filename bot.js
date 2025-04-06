require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events,
  EmbedBuilder,
} = require("discord.js");
const { PrismaClient } = require("@prisma/client");

const getFloorMagicEden = require("./Fetchers/magiceden");
const { startFloorTracker } = require("./floorTracker");
const getFloorPrice = require("./utils/getFloorPrice");

const prisma = new PrismaClient();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName("addcollection")
    .setDescription("Track an NFT collection's floor price")
    .addStringOption(option => option.setName("name").setDescription("Collection name").setRequired(true))
    .addStringOption(option => option.setName("url").setDescription("Collection URL").setRequired(true))
    .addStringOption(option =>
      option.setName("chain")
        .setDescription("Chain name (select from list)")
        .setRequired(true)
        .addChoices(
          { name: "Solana", value: "solana" },
          { name: "Ethereum", value: "ethereum" },
          { name: "Base", value: "base" },
          { name: "Arbitrum", value: "arbitrum" },
          { name: "Apechain", value: "apechain" },
          { name: "Optimism", value: "optimism" },
          { name: "Polygon", value: "polygon" },
          { name: "Zora", value: "zora" },
          { name: "Avalanche", value: "avalanche" },
          { name: "BNB", value: "bsc" },
          { name: "Berachain", value: "berachain" },
        )
    )
    .addStringOption(option => option.setName("channel").setDescription("Thread ID to post updates").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removecollection")
    .setDescription("Stop tracking a collection")
    .addStringOption(option => option.setName("name").setDescription("Name of the collection to remove").setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName("showcollections")
    .setDescription("Display all tracked collections")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands(clientId) {
  try {
    console.log("⏳ Registering slash commands...");
    const guildId = "1311286470786678855";
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
}

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  startFloorTracker(client);
  registerCommands(client.application.id);
});

function formatNumber(value) {
  if (typeof value === "bigint") value = Number(value); // convert BigInt for formatting
  if (typeof value !== "number") return value;
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(2) + "K";
  return value.toFixed(2);
}

async function trackFloors() {
  console.log("🔄 Running floor check...");
  const collections = await prisma.collection.findMany();

  for (const col of collections) {
    console.log(`📦 Checking: ${col.name} [${col.marketplace} on ${col.chain}]`);

    let result = null;

    if (col.marketplace === "magiceden") {
      result = await getFloorMagicEden(col.slug, col.chain);
    } else if (col.marketplace === "opensea") {
      result = await getFloorPrice(col.slug, col.chain, col.marketplace);
    }

    if (result && result.floorPrice != null) {
      const prevFloor = col.lastFloorPrice;
      const floorChanged = prevFloor !== result.floorPrice;

      if (floorChanged) {
        const directionEmoji = prevFloor == null ? "💰" : result.floorPrice > prevFloor ? "🔺" : "🔻";
        const thread = await client.channels.fetch(col.channel);

        const mainStats = [
          "```",
          `💰 Floor       : ${result.floorPrice}`,
          `🛒 Marketplace : ${col.marketplace === "magiceden" ? "Magic Eden" : "OpenSea"}`,
          `⛓️ Chain       : ${col.chain}`,
          "```"
        ];

        let extraStats = [];

        if (col.marketplace === "magiceden") {
          extraStats = [
            "**Extra Stats**",
            "```",
            `Listed NFTs   : ${formatNumber(result.listedCount ?? "?")}`,
            `Volume        : ${formatNumber(result.volumeAll)}◎`,
            `Avg Price     : ${formatNumber(result.avgPrice24hr)}◎`,
            "```"
          ];
        } else if (col.marketplace === "opensea" && result.total) {
          const total = result.total;
          extraStats = [
            "**Extra Stats**",
            "```",
            `Volume        : ${formatNumber(total.volume)}`,
            `Sales         : ${formatNumber(total.sales)}`,
            `Owners        : ${formatNumber(total.num_owners)}`,
            "```"
          ];
        }

        const collectionLink =
          col.marketplace === "magiceden"
            ? `https://magiceden.io/marketplace/${col.slug}`
            : `https://opensea.io/collection/${col.slug}`;

        const embed = new EmbedBuilder()
          .setTitle(`${directionEmoji} ${col.name}`)
          .setURL(collectionLink)
          .setColor(result.floorPrice > prevFloor ? 0x00ff00 : 0xff0000)
          .setTimestamp()
          .setDescription([...mainStats, "", ...extraStats].join("\n"));

        if (col.imageUrl) {
          embed.setImage(col.imageUrl);
          embed.setThumbnail(col.logoUrl);
        }

        await thread.send({ embeds: [embed] });

        console.log(`✅ Posted floor for ${col.name}: ${result.floorPrice}`);

        await prisma.collection.update({
          where: { id: col.id },
          data: { lastFloorPrice: result.floorPrice },
        });
      }
    }
  }
}

setInterval(trackFloors, 60 * 1000);

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    const collections = await prisma.collection.findMany();
    const choices = collections.map(c => c.name);
    const filtered = choices.filter(name => name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map(name => ({ name, value: name })));
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "addcollection") {
    const name = interaction.options.getString("name");
    const url = interaction.options.getString("url");
    const chain = interaction.options.getString("chain");
    const channel = interaction.options.getString("channel");

    function extractSlugAndMarketplace(url) {
      const lower = url.toLowerCase();
      if (lower.includes("opensea.io")) {
        const match = url.match(/opensea\.io\/collection\/([^/?#]+)/);
        return match ? { slug: match[1], marketplace: "opensea" } : null;
      }
      if (lower.includes("magiceden.io")) {
        const solMatch = url.match(/magiceden\.io\/marketplace\/([^/?#]+)/);
        if (solMatch) return { slug: solMatch[1], marketplace: "magiceden", chain: "solana" };
        const ordinalsMatch = url.match(/magiceden\.io\/ordinals\/marketplace\/([^/?#]+)/);
        if (ordinalsMatch) return { slug: ordinalsMatch[1], marketplace: "magiceden", chain: "bitcoin" };
        const evmMatch = url.match(/magiceden\.io\/collections\/([^/]+)\/([^/?#]+)/);
        if (evmMatch) return { slug: evmMatch[2], marketplace: "magiceden", chain: evmMatch[1] };
      }
      return null;
    }

    const parsed = extractSlugAndMarketplace(url);
    if (!parsed) return interaction.reply({ content: "❌ Could not detect slug or marketplace from the URL.", ephemeral: true });

    const { slug, marketplace, chain: detectedChain } = parsed;
    const finalChain = detectedChain || chain;

    let imageUrl = null;
    if (marketplace === "magiceden") {
      const res = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${slug}`);
      const data = await res.json();
      imageUrl = data?.image;
    } else if (marketplace === "opensea") {
      const res = await fetch(`https://api.opensea.io/api/v2/collections/${slug}`);
      const json = await res.json();
      imageUrl = json?.collection?.image_url;
    }

    try {
      await prisma.collection.create({
        data: {
          name,
          chain: finalChain,
          marketplace,
          slug,
          channel,
          contractAddress: "mock-for-now",
          imageUrl,
        },
      });
      console.log(`✅ Added collection: ${name} on ${finalChain} (${marketplace})`);
      await interaction.reply(`✅ Added collection **${name}** on **${chain}** (${marketplace})`);
    } catch (err) {
      console.error(err);
      await interaction.reply(`❌ Failed to add collection: ${err.message}`);
    }
  }

  if (interaction.commandName === "removecollection") {
    const name = interaction.options.getString("name");
    try {
      const deleted = await prisma.collection.deleteMany({ where: { name } });
      if (deleted.count > 0) {
        await interaction.reply(`🗑️ Removed **${name}** from tracking.`);
      } else {
        await interaction.reply(`❌ No collection found with the name "${name}".`);
      }
    } catch (err) {
      console.error(err);
      await interaction.reply(`❌ Error removing collection: ${err.message}`);
    }
  }

  if (interaction.commandName === "showcollections") {
    const collections = await prisma.collection.findMany();
    if (!collections.length) return interaction.reply("❌ No collections currently being tracked.");

    const formatMarketplace = (mp) => mp === "magiceden" ? "Magic Eden" : mp === "opensea" ? "OpenSea" : mp;
    const formatChain = (chain) => chain.toUpperCase();
    const formatLink = (mp, slug) => mp === "magiceden" ? `https://magiceden.io/marketplace/${slug}` : `https://opensea.io/collection/${slug}`;
    const formatFloor = (col) => col.lastFloorPrice == null ? "N/A" : `${col.lastFloorPrice}`;

    const lines = collections.map((col, index) => {
      const bullet = ["🟢", "🔵", "🟡", "🟣", "🟠", "🔴"][index % 6];
      return (
        `${bullet} ${col.name}\n` +
        `  📍 Platform: ${formatMarketplace(col.marketplace)}\n` +
        `  ⛓️ Chain: ${formatChain(col.chain)}\n` +
        `  💰 Floor: ${formatFloor(col)}\n` +
        `  🔗 [View Collection](${formatLink(col.marketplace, col.slug)})\n` +
        `\u200B`
      );
    });

    const embed = new EmbedBuilder()
      .setTitle("📊 Tracked NFT Collections")
      .setDescription(lines.join("\n"))
      .setColor(0x5865f2)
      .setFooter({ text: "NFT Floor Bot" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);

// Optional test calls
(async () => {
  const res = await getFloorMagicEden("okay_bears", "solana");
  console.log("🧪 Magic Eden Test:", res);
})();
(async () => {
  const result = await getFloorPrice("yumemono", "ethereum", "opensea");
  console.log("🧪 OpenSea Test:", result);
})();
