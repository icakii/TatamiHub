// One-off diagnostic: prints Kime's current club_billing row to check
// whether the paddle-webhook has updated it after a test payment.
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
}

const supabase = createClient('https://oosgutqxpnvkfslxatyx.supabase.co', serviceRoleKey)

async function main() {
  const { data, error } = await supabase
    .from('club_billing')
    .select('*')
    .eq('club_id', 'c1000000-0000-4000-8000-000000000001')
    .single()
  if (error) throw error
  console.log(JSON.stringify(data, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
