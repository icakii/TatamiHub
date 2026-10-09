// One-time: registers the deployed paddle-webhook edge function as a Paddle
// notification destination. Run with
// `npx tsx scripts/create-paddle-webhook-destination.ts`, then set the
// printed secret as a Supabase function secret:
//   npx supabase secrets set PADDLE_WEBHOOK_SECRET=<secretKey>
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

const apiKey = process.env.PADDLE_SANDBOX_API_KEY
if (!apiKey) {
  throw new Error('Set PADDLE_SANDBOX_API_KEY before running this script.')
}

const paddle = new Paddle(apiKey, {
  environment: Environment.sandbox,
})

async function main() {
  const destination = await paddle.notificationSettings.create({
    description: 'TatamiHub club_billing sync',
    type: 'url',
    destination: 'https://oosgutqxpnvkfslxatyx.supabase.co/functions/v1/paddle-webhook',
    subscribedEvents: [
      'transaction.completed',
      'subscription.created',
      'subscription.updated',
      'subscription.canceled',
      'customer.created',
      'customer.updated',
    ],
  })

  console.log(JSON.stringify(destination, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
