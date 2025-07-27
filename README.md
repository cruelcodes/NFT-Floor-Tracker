# 🧾 NFT Floor Tracker Discord Bot

A Discord bot that monitors NFT collections and automatically sends floor price updates to your Discord server. It fetches real-time floor prices from major marketplaces and supports multiple collections.

---

## 📦 Features

- 🔍 Real-time NFT floor price tracking from marketplaces like OpenSea and Magic Eden
- 🔔 Sends floor price updates to Discord via bot messages or webhooks
- 🛠 Built using Node.js, Prisma, and Discord.js
- 🗃 Supports multiple collections with customizable tracking intervals
- 📁 Modular folder structure (Fetchers, Prisma, Utils)

---

## 🛠 Tech Stack

- **Node.js**
- **Discord.js**
- **Prisma ORM**
- **SQLite** (can switch to PostgreSQL or MySQL)
- **Axios**

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/cruelcodes/Nft-floor-Tracker.git
cd Nft-floor-Tracker
npm install
```
### 2. Create .env file
```bash
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
DATABASE_URL=file:./dev.db
```
