// One-time setup: creates the Tatami platform-billing product + price in
// Paddle. Run with `npx tsx scripts/seed-paddle-catalog.ts`, then paste the
// printed price ID into wherever we wire up checkout.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) {
  throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')
}

const paddle = new Paddle(apiKey, {
  environment: Environment.sandbox,
})

async function seed() {
  const product = await paddle.products.create({
    name: 'Tatami — Website & Club Management',
    taxCategory: 'saas',
    description:
      'Custom club website plus ongoing membership management (adding students, billing, announcements), handled by Tatami.',
  })

  const monthly = await paddle.prices.create({
    productId: product.id,
    description: 'Tatami monthly plan EUR',
    unitPrice: { amount: '9900', currencyCode: 'EUR' }, // 9900 cents = 99.00 EUR
    billingCycle: { interval: 'month', frequency: 1 },
  })

  console.log(JSON.stringify({ productId: product.id, monthlyPriceId: monthly.id }, null, 2))
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
