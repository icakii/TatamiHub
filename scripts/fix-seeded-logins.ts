// Recreates the seeded coach/student logins through the Admin API after
// migration 0017 removed their broken auth rows, then relinks the members
// rows. Safe to re-run: members that already have a working login are skipped.
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
}

const ACCOUNTS = [
  { memberId: 'd1000000-0000-4000-8000-000000000002', email: 'coach@kime.demo', password: 'KimeCoachDemo!2026' },
  { memberId: 'd1000000-0000-4000-8000-000000000003', email: 'student1@kime.demo', password: 'KimeStudentDemo!2026' },
  { memberId: 'd1000000-0000-4000-8000-000000000004', email: 'student2@kime.demo', password: 'KimeStudentDemo!2026' },
]

const supabase = createClient('https://oosgutqxpnvkfslxatyx.supabase.co', serviceRoleKey)

async function main() {
  for (const account of ACCOUNTS) {
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('user_id')
      .eq('id', account.memberId)
      .single()
    if (memberError) throw memberError
    if (member.user_id) {
      console.log('Already has a login, skipping:', account.email)
      continue
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    })
    if (createError || !created.user) throw createError ?? new Error('createUser returned no user')

    const { error: updateError } = await supabase
      .from('members')
      .update({ user_id: created.user.id })
      .eq('id', account.memberId)
    if (updateError) throw updateError

    console.log('Login with:', account.email, '/', account.password)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
