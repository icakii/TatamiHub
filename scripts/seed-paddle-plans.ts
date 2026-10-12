// One-time setup for the plan ladder (2026-10-12): Сайт, Клуб and Клуб Pro,
// each a one-off setup fee plus a monthly price, VAT included via the
// account's tax setting. Клуб reuses the existing product and 99 EUR price.
// Run with `npx tsx scripts/seed-paddle-plans.ts` and copy the IDs into the
// Tatami site's src/lib/paddle.ts.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')

const paddle = new Paddle(apiKey, { environment: Environment.sandbox })
const CLUB_PRODUCT_ID = 'pro_01m4gns7wv84ppz8vfqpc0wjr9'

async function oneOff(productId: string, description: string, cents: string) {
  return paddle.prices.create({ productId, description, unitPrice: { amount: cents, currencyCode: 'EUR' } })
}

async function monthly(productId: string, description: string, cents: string) {
  return paddle.prices.create({
    productId,
    description,
    unitPrice: { amount: cents, currencyCode: 'EUR' },
    billingCycle: { interval: 'month', frequency: 1 },
  })
}

async function seed() {
  const site = await paddle.products.create({
    name: 'Tatami — Сайт',
    taxCategory: 'saas',
    description: 'Website up to 5 pages with hosting, backups and small monthly changes, run by Tatami.',
  })
  const pro = await paddle.products.create({
    name: 'Tatami — Клуб Pro',
    taxCategory: 'saas',
    description: 'Club website, student app, store and admin panel, run by Tatami.',
  })

  const ids = {
    siteSetup: (await oneOff(site.id, 'Сайт setup EUR', '25000')).id,
    siteMonthly: (await monthly(site.id, 'Сайт monthly EUR', '2900')).id,
    clubSetup: (await oneOff(CLUB_PRODUCT_ID, 'Клуб setup EUR', '35000')).id,
    proSetup: (await oneOff(pro.id, 'Клуб Pro setup EUR', '65000')).id,
    proMonthly: (await monthly(pro.id, 'Клуб Pro monthly EUR', '14900')).id,
  }
  console.log(JSON.stringify(ids, null, 2))
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
