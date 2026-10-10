// One-time setup: the optional "we register and manage a domain for you"
// add-on sold on the Tatami site next to the 99 EUR plan. Run with
// `npx tsx scripts/seed-paddle-domain-addon.ts` and copy the price ID into
// the Tatami site's src/lib/paddle.ts.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) {
  throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')
}

const paddle = new Paddle(apiKey, { environment: Environment.sandbox })

async function seed() {
  const product = await paddle.products.create({
    name: 'Tatami domain add-on',
    taxCategory: 'saas',
    description: 'A new domain registered, renewed and managed by Tatami for the club website.',
  })

  const price = await paddle.prices.create({
    productId: product.id,
    description: 'Domain add-on monthly EUR',
    unitPrice: { amount: '1000', currencyCode: 'EUR' },
    billingCycle: { interval: 'month', frequency: 1 },
  })

  console.log(JSON.stringify({ productId: product.id, priceId: price.id }, null, 2))
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
