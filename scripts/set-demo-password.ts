// One-time: the seeded owner@kime.demo auth user was inserted directly via
// seed SQL (never through GoTrue's real signup path), so it's malformed and
// can't be updated or logged into ("Database error loading user"). Delete
// it and recreate properly via the admin API, then repoint the members row
// at the new, working account.
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
}

const OLD_USER_ID = 'a1000000-0000-4000-8000-000000000001' // broken owner@kime.demo
const OWNER_MEMBER_ID = 'd1000000-0000-4000-8000-000000000001'
const EMAIL = 'owner@kime.demo'
const NEW_PASSWORD = 'KimeOwnerDemo!2026'

const supabase = createClient('https://oosgutqxpnvkfslxatyx.supabase.co', serviceRoleKey)

async function main() {
  const { error: deleteError } = await supabase.auth.admin.deleteUser(OLD_USER_ID)
  if (deleteError) {
    console.warn('Delete of old user failed (continuing anyway):', deleteError.message)
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw createError ?? new Error('createUser returned no user')
  }

  const { error: updateError } = await supabase
    .from('members')
    .update({ user_id: created.user.id })
    .eq('id', OWNER_MEMBER_ID)
  if (updateError) throw updateError

  console.log('Login with:', EMAIL, '/', NEW_PASSWORD)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
