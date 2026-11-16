// Example data for Спартак 14 so the club, and the clubs we show it to, can
// try everything: three logins, a dozen students, fees, attendance, grades,
// a competition and a news item. Everything here is made up.
// Run with: npx tsx scripts/seed-spartak-demo.ts   (needs SUPABASE_SERVICE_ROLE_KEY)
// Safe to re-run: logins are reused, students are only added once.
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
const db = createClient('https://oosgutqxpnvkfslxatyx.supabase.co', serviceRoleKey, { auth: { persistSession: false } })

const LOGINS = {
  coach: { email: 'trener@spartak.demo', password: 'SpartakTrener2026!' },
  parent: { email: 'roditel@spartak.demo', password: 'SpartakRoditel2026!' },
  student: { email: 'uchenik@spartak.demo', password: 'SpartakUchenik2026!' },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data
}

async function login(email: string, password: string): Promise<string> {
  const { data: found } = await db.rpc('auth_user_id_by_email', { p_email: email })
  if (found) return found as string
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('createUser failed')
  return data.user.id
}

async function main() {
  const club = await must(db.from('clubs').select('id').eq('slug', 'spartak').single())
  const clubId = (club as { id: string }).id

  // All extras on, so every function can be shown.
  await must(db.from('clubs').update({ grades_enabled: true, qr_checkin_enabled: true, store_enabled: true }).eq('id', clubId))

  const existing = await must(db.from('members').select('id').eq('club_id', clubId).limit(1))
  if ((existing as unknown[]).length) {
    console.log('Spartak already has members, skipping the example data.')
    return
  }

  const belts = (await must(db.from('belts').select('id, rank').eq('club_id', clubId).order('rank'))) as { id: string; rank: number }[]
  const groups = (await must(db.from('groups').select('id, name').eq('club_id', clubId))) as { id: string; name: string }[]
  const group = (prefix: string) => groups.find((g) => g.name.startsWith(prefix))!.id
  const belt = (i: number) => belts[Math.min(i, belts.length - 1)].id
  const year = new Date().getFullYear()

  const coachUser = await login(LOGINS.coach.email, LOGINS.coach.password)
  const parentUser = await login(LOGINS.parent.email, LOGINS.parent.password)
  const studentUser = await login(LOGINS.student.email, LOGINS.student.password)

  await must(
    db.from('members').insert({
      club_id: clubId, user_id: coachUser, role: 'owner', full_name: 'Треньор Демо', email: LOGINS.coach.email, status: 'active',
    }),
  )

  type S = { name: string; age: number; group: string; belt: number; fee: number; parent?: string; phone?: string; user?: string; email?: string; h?: number; w?: number }
  const students: S[] = [
    { name: 'Мария Петрова', age: 9, group: 'Начинаещи 8', belt: 0, fee: 40, parent: 'Елена Петрова', phone: '0888 100 201', user: parentUser, email: LOGINS.parent.email, h: 134, w: 29 },
    { name: 'Николай Петров', age: 6, group: 'Начинаещи до 7', belt: 0, fee: 35, parent: 'Елена Петрова', phone: '0888 100 201', user: parentUser, email: LOGINS.parent.email, h: 118, w: 22 },
    { name: 'Виктор Иванов', age: 15, group: 'Напреднали 13', belt: 6, fee: 50, phone: '0888 100 202', user: studentUser, email: LOGINS.student.email, h: 171, w: 58 },
    { name: 'Александра Димитрова', age: 7, group: 'Напреднали до 8', belt: 2, fee: 40, parent: 'Ивайло Димитров', phone: '0888 100 203' },
    { name: 'Георги Стоянов', age: 11, group: 'Напреднали 8', belt: 4, fee: 45, parent: 'Мила Стоянова', phone: '0888 100 204' },
    { name: 'Калина Тодорова', age: 12, group: 'Напреднали 8', belt: 5, fee: 45, parent: 'Петя Тодорова', phone: '0888 100 205' },
    { name: 'Борис Колев', age: 10, group: 'Начинаещи 8', belt: 1, fee: 40, parent: 'Христо Колев', phone: '0888 100 206' },
    { name: 'Йоана Маринова', age: 14, group: 'Напреднали 13', belt: 7, fee: 50, phone: '0888 100 207' },
    { name: 'Даниел Ангелов', age: 16, group: 'Напреднали 13', belt: 8, fee: 50, phone: '0888 100 208' },
    { name: 'Симона Григорова', age: 6, group: 'Начинаещи до 7', belt: 0, fee: 35, parent: 'Ана Григорова', phone: '0888 100 209' },
    { name: 'Мартин Попов', age: 8, group: 'Напреднали до 8', belt: 3, fee: 40, parent: 'Стефан Попов', phone: '0888 100 210' },
    { name: 'Теодора Василева', age: 13, group: 'Напреднали 13', belt: 6, fee: 50, phone: '0888 100 211' },
  ]
  const rows = students.map((s, i) => {
    const [first, ...last] = (s.parent ?? '').split(' ')
    return {
      club_id: clubId,
      user_id: s.user ?? null,
      role: 'student',
      full_name: s.name,
      email: s.email ?? null,
      phone: s.parent ? null : s.phone,
      status: i === 9 ? 'trial' : 'active',
      birth_year: year - s.age,
      group_id: group(s.group),
      belt_id: belt(s.belt),
      monthly_fee_cents: s.fee * 100,
      height_cm: s.h ?? null,
      weight_kg: s.w ?? null,
      guardian_first_name: s.parent ? first : null,
      guardian_last_name: s.parent ? last.join(' ') : null,
      guardian_phone: s.parent ? s.phone : null,
      joined_at: iso(new Date(year - 1, 8, 15)),
    }
  })
  const members = (await must(db.from('members').insert(rows).select('id, full_name, group_id, monthly_fee_cents'))) as {
    id: string
    full_name: string
    group_id: string
    monthly_fee_cents: number
  }[]
  const byName = (n: string) => members.find((m) => m.full_name === n)!

  // This month paid for most, by cash or card; four still owe.
  const now = new Date()
  const start = iso(new Date(now.getFullYear(), now.getMonth(), 1))
  const end = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const owe = new Set(['Борис Колев', 'Мартин Попов', 'Даниел Ангелов', 'Симона Григорова'])
  await must(
    db.from('payments').insert(
      members
        .filter((m) => !owe.has(m.full_name))
        .map((m, i) => ({
          club_id: clubId, member_id: m.id, amount_cents: m.monthly_fee_cents, currency: 'EUR', method: i % 3 === 0 ? 'card' : 'cash',
          period_start: start, period_end: end, status: 'paid', recorded_by: coachUser,
        })),
    ),
  )

  // Two weeks of attendance on each student's group trainings.
  const classes = (await must(db.from('classes').select('id, weekday, group_id').eq('club_id', clubId))) as { id: string; weekday: number; group_id: string }[]
  const attendance: Record<string, unknown>[] = []
  for (let d = 14; d >= 1; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
    const weekday = (day.getDay() + 6) % 7
    for (const c of classes.filter((x) => x.weekday === weekday)) {
      for (const m of members.filter((x) => x.group_id === c.group_id)) {
        attendance.push({
          club_id: clubId, class_id: c.id, member_id: m.id, session_date: iso(day),
          status: (m.full_name.length + d) % 6 === 0 ? 'absent' : 'present', marked_by: coachUser,
        })
      }
    }
  }
  if (attendance.length) await must(db.from('attendance').upsert(attendance, { onConflict: 'class_id,member_id,session_date' }))

  await must(
    db.from('member_grades').insert([
      { club_id: clubId, member_id: byName('Мария Петрова').id, stars: 5, note: 'Отлична стойка', given_on: iso(new Date(now.getTime() - 5 * 864e5)), given_by: coachUser },
      { club_id: clubId, member_id: byName('Мария Петрова').id, stars: 4, note: 'Да работи върху ката', given_on: iso(new Date(now.getTime() - 12 * 864e5)), given_by: coachUser },
      { club_id: clubId, member_id: byName('Николай Петров').id, stars: 5, note: 'Много старание', given_on: iso(new Date(now.getTime() - 3 * 864e5)), given_by: coachUser },
      { club_id: clubId, member_id: byName('Виктор Иванов').id, stars: 4, note: 'Добро кумите', given_on: iso(new Date(now.getTime() - 4 * 864e5)), given_by: coachUser },
    ]),
  )

  await must(
    db.from('competitions').insert({
      club_id: clubId, name: 'Държавно първенство по Шотокан карате', location: 'София, зала „Фестивална“',
      event_date: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 24)),
    }),
  )

  await must(
    db.from('notifications').insert(
      [byName('Мария Петрова'), byName('Николай Петров'), byName('Виктор Иванов')].map((m) => ({
        club_id: clubId, member_id: m.id, title: 'Изпит за колан през декември',
        body: 'Изпитът за техническа степен е в събота след три седмици. Записване при треньора до края на месеца.',
      })),
    ),
  )

  console.log('Spartak example data ready:', members.length, 'students,', attendance.length, 'attendance marks')
  console.log(LOGINS)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
