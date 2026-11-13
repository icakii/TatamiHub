// One-time: sets up the LIVE Paddle account in one go, mirroring the sandbox
// catalogue (2026-11-13 prices, VAT included in every price):
//   Сайт 250 + 29/month, Клуб 350 + 110/month, Клуб Pro 650 + 149/month,
//   domain add-on 10/month,
// plus a client-side token for checkout and the webhook destination.
//
// Run once, after Paddle has approved the live account and tatamistudio.net:
//   $env:PADDLE_LIVE_API_KEY="pdl_live_apikey_..."; npx.cmd tsx scripts/paddle-go-live.ts
// It prints the price IDs for the Tatami site and the two secrets to set.
// Running it twice creates a second catalogue, so don't.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_LIVE_API_KEY
if (!apiKey) throw new Error('Set PADDLE_LIVE_API_KEY before running this script.')

const paddle = new Paddle(apiKey, { environment: Environment.production })
const WEBHOOK_URL = 'https://oosgutqxpnvkfslxatyx.supabase.co/functions/v1/paddle-webhook'

// Paddle sells software, so each plan is described as the software it is.
const PLANS = [
  {
    key: 'site',
    name: 'Tatami — Сайт',
    description: 'Hosted website for a sports club, managed on the Tatami platform: pages, news, contact form, hosting, SSL and backups.',
    setup: '25000',
    monthly: '2900',
  },
  {
    key: 'club',
    name: 'Tatami — Клуб',
    description: 'Club website plus the Tatami student app and coach panel: schedule, attendance, fee tracking, news, up to 75 students.',
    setup: '35000',
    monthly: '11000',
  },
  {
    key: 'club_pro',
    name: 'Tatami — Клуб Pro',
    description: 'Everything in Клуб without a student limit, plus store reservations, QR check-in, coach grades and club statistics.',
    setup: '65000',
    monthly: '14900',
  },
] as const

async function main() {
  const prices: Record<string, { setup: string; monthly: string }> = {}
  for (const plan of PLANS) {
    const product = await paddle.products.create({ name: plan.name, taxCategory: 'saas', description: plan.description })
    const setup = await paddle.prices.create({
      productId: product.id,
      description: `${plan.name} setup EUR`,
      unitPrice: { amount: plan.setup, currencyCode: 'EUR' },
      taxMode: 'internal',
    })
    const monthly = await paddle.prices.create({
      productId: product.id,
      description: `${plan.name} monthly EUR`,
      unitPrice: { amount: plan.monthly, currencyCode: 'EUR' },
      billingCycle: { interval: 'month', frequency: 1 },
      taxMode: 'internal',
    })
    prices[plan.key] = { setup: setup.id, monthly: monthly.id }
  }

  const domainProduct = await paddle.products.create({
    name: 'Tatami — domain add-on',
    taxCategory: 'saas',
    description: 'A new domain registered, renewed and managed by Tatami for the club website.',
  })
  const domain = await paddle.prices.create({
    productId: domainProduct.id,
    description: 'Domain add-on monthly EUR',
    unitPrice: { amount: '1000', currencyCode: 'EUR' },
    billingCycle: { interval: 'month', frequency: 1 },
    taxMode: 'internal',
  })

  const token = await paddle.clientTokens.create({ name: 'Tatami site checkout (live)' })
  const webhook = await paddle.notificationSettings.create({
    description: 'TatamiHub club_billing sync (live)',
    type: 'url',
    destination: WEBHOOK_URL,
    subscribedEvents: [
      'transaction.completed',
      'subscription.created',
      'subscription.updated',
      'subscription.canceled',
      'customer.created',
      'customer.updated',
    ],
  })

  console.log('\n1) Tatami site, src/lib/paddle.ts → PRICE_IDS.production:')
  console.log(JSON.stringify({ ...prices, domain: domain.id }, null, 2))
  console.log('\n2) Render → Tatami site → Environment:')
  console.log(`   VITE_PADDLE_ENV=production`)
  console.log(`   VITE_PADDLE_CLIENT_TOKEN=${token.token}`)
  console.log('\n3) Supabase function secrets (in C:\\Dev\\TatamiHub):')
  console.log(`   npx.cmd supabase secrets set PADDLE_WEBHOOK_SECRET=${webhook.endpointSecretKey}`)
  console.log(`   npx.cmd supabase secrets set PADDLE_API_URL=https://api.paddle.com PADDLE_API_KEY=<the same live API key>`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
