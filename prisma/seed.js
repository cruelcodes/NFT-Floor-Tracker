const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.collection.create({
    data: {
      name: 'Test Collection',
      slug: 'test-collection',
      chain: 'solana',
      marketplace: 'MagicEden',
      contractAddress: 'testcontract123',
      channel: 'test-channel',
      imageUrl: 'https://example.com/image.png',
      lastFloorPrice: 1.23,
    },
  });

  console.log('✅ Seeded one test collection with imageUrl');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
