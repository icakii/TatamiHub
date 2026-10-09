// One-time: creates a client-side token (safe to expose in a browser) for
// embedding Paddle Checkout in KimeClub. Run with
// `npx tsx scripts/create-paddle-client-token.ts`, then paste the printed
// token into KimeClub's env as VITE_PADDLE_CLIENT_TOKEN.
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) {
  throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')
}

const paddle = new Paddle(apiKey, {
  environment: Environment.sandbox,
})

async function main() {
  const token = await paddle.clientTokens.create({ name: 'KimeClub checkout (sandbox)' })
  console.log(JSON.stringify(token, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
