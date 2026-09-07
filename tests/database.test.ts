import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { example } from '../src/partner'

const owner = '00000000-0000-4000-8000-000000000001'
const stranger = '00000000-0000-4000-8000-000000000002'
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users (id) values ('${owner}'), ('${stranger}');
  `)
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/202609080001_create_homes.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
})
afterAll(async () => {
  await db?.close()
})

async function asUser<T>(
  id: string | null,
  action: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    id ?? '',
  ])
  try {
    return await action()
  } finally {
    await db.exec('reset role')
  }
}

async function insert(
  id: string,
  plot: number,
  published = false,
  partner: unknown = example,
) {
  return db.query(
    'insert into public.homes (owner_id, plot, partner, published) values ($1, $2, $3, $4)',
    [id, plot, JSON.stringify(partner), published],
  )
}

describe('PostgreSQL constraints and RLS', () => {
  it('denies unauthenticated writes and forged ownership', async () => {
    await expect(asUser(null, () => insert(owner, 0))).rejects.toThrow()
    await expect(asUser(stranger, () => insert(owner, 0))).rejects.toThrow()
  })
  it('allows an owner to save and read a private home', async () => {
    await asUser(owner, () => insert(owner, 0))
    const result = await asUser(owner, () =>
      db.query('select partner from public.homes'),
    )
    expect(result.rows).toEqual([{ partner: example }])
  })
  it('hides private homes from guests and other users', async () => {
    expect(
      (await asUser(null, () => db.query('select * from public.homes'))).rows,
    ).toHaveLength(0)
    expect(
      (await asUser(stranger, () => db.query('select * from public.homes')))
        .rows,
    ).toHaveLength(0)
  })
  it('does not update or delete another user’s private home', async () => {
    expect(
      (
        await asUser(stranger, () =>
          db.query('update public.homes set published = true returning *'),
        )
      ).rows,
    ).toHaveLength(0)
    expect(
      (
        await asUser(stranger, () =>
          db.query('delete from public.homes returning *'),
        )
      ).rows,
    ).toHaveLength(0)
  })
  it('rejects invalid JSON and out-of-range plots even without client validation', async () => {
    for (const value of [
      null,
      {},
      { ...example, version: 2 },
      { ...example, lines: [] },
      { ...example, lines: [{ text: 'missing scene' }] },
      { ...example, lines: [{ scene: 'day', text: 'a'.repeat(161) }] },
      { ...example, lines: [{ scene: 'day', text: '\n\t' }] },
      { ...example, owner_id: owner },
    ]) {
      await expect(
        asUser(stranger, () => insert(stranger, 1, false, value)),
      ).rejects.toThrow()
    }
    await expect(asUser(stranger, () => insert(stranger, 12))).rejects.toThrow()
  })
  it('reserves a plot even when its home is private', async () => {
    await expect(asUser(stranger, () => insert(stranger, 0))).rejects.toThrow()
  })
  it('lets the owner publish and lets guests read the result', async () => {
    await asUser(owner, () =>
      db.query('update public.homes set published = true'),
    )
    expect(
      (await asUser(null, () => db.query('select partner from public.homes')))
        .rows,
    ).toEqual([{ partner: example }])
  })
  it('does not allow a reader to edit, delete, or take over a public home', async () => {
    expect(
      (
        await asUser(stranger, () =>
          db.query('update public.homes set plot = 2 returning *'),
        )
      ).rows,
    ).toHaveLength(0)
    expect(
      (
        await asUser(stranger, () =>
          db.query('delete from public.homes returning *'),
        )
      ).rows,
    ).toHaveLength(0)
    await expect(
      asUser(owner, () =>
        db.query('update public.homes set owner_id = $1', [stranger]),
      ),
    ).rejects.toThrow()
  })
  it('allows the owner to unpublish and then delete their home', async () => {
    await asUser(owner, () =>
      db.query('update public.homes set published = false'),
    )
    expect(
      (await asUser(null, () => db.query('select * from public.homes'))).rows,
    ).toHaveLength(0)
    expect(
      (
        await asUser(owner, () =>
          db.query('delete from public.homes returning *'),
        )
      ).rows,
    ).toHaveLength(1)
  })
})
