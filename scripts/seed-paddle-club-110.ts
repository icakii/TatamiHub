// 2026-10-21: the Клуб plan goes from 99 to 110 EUR/month (VAT included).
// Paddle prices can't be edited once used, so this adds a new monthly price
// on the same product; the old 99 EUR one is archived so it can't be bought.
// Run with `npx tsx scripts/seed-paddle-club-110.ts` and copy the ID into the
// Tatami site's src/lib/paddle.ts. Existing subscriptions keep their price.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')

const paddle = new Paddle(apiKey, { environment: Environment.sandbox })
const CLUB_PRODUCT_ID = 'pro_01m4gns7wv84ppz8vfqpc0wjr9'
const OLD_MONTHLY_PRICE_ID = 'pri_01m4gns82gsevvr8dn491mq5xh'

const price = await paddle.prices.create({
  productId: CLUB_PRODUCT_ID,
  description: 'Клуб monthly EUR (110)',
  unitPrice: { amount: '11000', currencyCode: 'EUR' },
  billingCycle: { interval: 'month', frequency: 1 },
})
await paddle.prices.archive(OLD_MONTHLY_PRICE_ID)

console.log({ clubMonthly: price.id })
