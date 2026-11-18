import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { PageTitle } from '../components/ui'
import { useClubs } from '../hooks/useClubs'
import {
  COLUMNS,
  timeAgo,
  useAddComment,
  useBoardLive,
  useDeleteComment,
  useDeleteFile,
  useDeleteNote,
  useNoteDetail,
  useNotes,
  useSaveNote,
  useSignedUrls,
  useUploadFiles,
  type BoardColumn,
  type NoteLink,
  type TeamNote,
} from '../hooks/useBoard'
import { openPrivateFile } from '../hooks/useLedger'
import { localISODate } from '../lib/date'

const input = 'mt-1 min-h-10 w-full rounded-md border border-line bg-ink px-3 text-sm text-text outline-none focus:border-straw'
const label = 'block text-[11px] uppercase tracking-wider text-muted'

// Claude's notes get their own little mark so you can tell them apart.
function Author({ name }: { name: string | null }) {
  const claude = name === 'Claude'
  return (
    <span className={`inline-flex items-center gap-1 ${claude ? 'text-amber' : 'text-straw'}`}>
      {claude && <span aria-hidden="true">✦</span>}
      {name ?? '?'}
    </span>
  )
}

// The founders' board: notes, tasks, files and links. Drag cards between
// columns; changes from the other founder or from Claude appear live.
export function Board() {
  useBoardLive()
  const { data: notes, isLoading } = useNotes()
  const { data: clubs } = useClubs()
  const save = useSaveNote()
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [club, setClub] = useState('')
  const [dragOver, setDragOver] = useState<BoardColumn | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes ?? []).filter(
      (n) => (!club || n.club_id === club) && (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)),
    )
  }, [notes, query, club])

  const open = notes?.find((n) => n.id === openId) ?? null

  async function create(column: BoardColumn) {
    const id = await save.mutateAsync({ fields: { title: 'New note', board_column: column, club_id: club || null } })
    setOpenId(id)
  }

  function onDrop(e: DragEvent, column: BoardColumn) {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/note')
    const note = notes?.find((n) => n.id === id)
    if (note && note.board_column !== column) {
      save.mutate({ id, fields: { board_column: column, position: Date.now() / 1000 } })
    }
  }

  return (
    <div className="px-6 py-8">
      <PageTitle title="Board" subtitle="Notes, tasks, files and links for the two of us. Claude can add and edit here too.">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="min-h-10 w-44 rounded-md border border-line bg-panel px-3 text-sm text-text outline-none focus:border-straw"
          />
          <select value={club} onChange={(e) => setClub(e.target.value)} className="min-h-10 rounded-md border border-line bg-panel px-3 text-sm text-text">
            <option value="">All clubs</option>
            {clubs?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => create('notes')} className="min-h-10 rounded-md bg-hanko px-4 font-display text-xs uppercase tracking-wide text-text hover:bg-hanko/90">
            + New note
          </button>
        </div>
      </PageTitle>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = shown.filter((n) => n.board_column === col.id)
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(col.id)
              }}
              onDragLeave={() => setDragOver((c) => (c === col.id ? null : c))}
              onDrop={(e) => onDrop(e, col.id)}
              className={`flex min-h-64 flex-col rounded-lg border bg-panel/60 p-3 transition-colors ${dragOver === col.id ? 'border-straw/60 bg-raised/60' : 'border-line'}`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wider text-text">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  {col.label}
                  <span className="text-xs text-muted">{items.length}</span>
                </h2>
                <button type="button" onClick={() => create(col.id)} className="rounded px-2 text-lg leading-none text-muted hover:text-text" aria-label={`Add to ${col.label}`}>
                  +
                </button>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {isLoading && <p className="p-2 text-xs text-muted">...</p>}
                {items.map((n) => (
                  <NoteCard key={n.id} note={n} onOpen={() => setOpenId(n.id)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {open && <NotePanel key={open.id} note={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function NoteCard({ note, onOpen }: { note: TeamNote; onOpen: () => void }) {
  const files = note.team_note_files[0]?.count ?? 0
  const comments = note.team_note_comments[0]?.count ?? 0
  const overdue = note.due_on && note.board_column !== 'done' && note.due_on < localISODate()
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/note', note.id)}
      onClick={onOpen}
      className="hub-enter group w-full cursor-grab rounded-md border border-line bg-raised p-3 text-left transition-colors hover:border-straw/40 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        {note.pinned && <span className="text-xs text-amber" title="Pinned">📌</span>}
        <p className="flex-1 font-medium text-text">{note.title}</p>
      </div>
      {note.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted">{note.body}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {note.club && <span className="rounded-full bg-ink px-2 py-0.5 text-straw">{note.club.name}</span>}
        {note.due_on && (
          <span className={`rounded-full px-2 py-0.5 ${overdue ? 'bg-hanko/20 text-hanko-text' : 'bg-ink text-muted'}`}>⏰ {note.due_on}</span>
        )}
        {files > 0 && <span className="text-muted">📎 {files}</span>}
        {note.links.length > 0 && <span className="text-muted">🔗 {note.links.length}</span>}
        {comments > 0 && <span className="text-muted">💬 {comments}</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        <Author name={note.author_name} /> · {timeAgo(note.created_at)}
        {note.updated_by_name && note.updated_at.slice(0, 16) !== note.created_at.slice(0, 16) && (
          <span> · edited by {note.updated_by_name} {timeAgo(note.updated_at)}</span>
        )}
      </p>
    </button>
  )
}

function NotePanel({ note, onClose }: { note: TeamNote; onClose: () => void }) {
  const save = useSaveNote()
  const remove = useDeleteNote()
  const { data: clubs } = useClubs()
  const { data: detail } = useNoteDetail(note.id)
  const upload = useUploadFiles(note.id)
  const delFile = useDeleteFile()
  const addComment = useAddComment(note.id)
  const delComment = useDeleteComment()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [link, setLink] = useState({ label: '', url: '' })
  const [comment, setComment] = useState('')
  const [dropping, setDropping] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const images = (detail?.files ?? []).filter((f) => f.mime?.startsWith('image/'))
  const { data: thumbs } = useSignedUrls(images.map((f) => f.path))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Someone else (or Claude) edited the note while it's open and we have no
  // unsaved changes: show theirs.
  const dirty = title !== note.title || body !== note.body
  useEffect(() => {
    if (!dirty) {
      setTitle(note.title)
      setBody(note.body)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.title, note.body])

  const update = (fields: Parameters<typeof save.mutate>[0]['fields']) => save.mutate({ id: note.id, fields })
  const saveText = () => dirty && title.trim() && update({ title: title.trim(), body })

  function addLink(e: FormEvent) {
    e.preventDefault()
    let url = link.url.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    const links: NoteLink[] = [...note.links, { label: link.label.trim() || url.replace(/^https?:\/\//, ''), url }]
    update({ links })
    setLink({ label: '', url: '' })
  }

  async function sendComment(e: FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    await addComment.mutateAsync(comment.trim())
    setComment('')
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/70 backdrop-blur-sm" onClick={() => (saveText(), onClose())}>
      <aside
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="hub-pop flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-panel p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <input
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveText}
            className="min-w-0 flex-1 bg-transparent font-display text-xl uppercase tracking-wide text-text outline-none"
            aria-label="Title"
          />
          <button type="button" onClick={() => (saveText(), onClose())} className="rounded px-2 text-xl text-muted hover:text-text" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          by <Author name={note.author_name} /> · {new Date(note.created_at).toLocaleString('en-GB')}
          {note.updated_by_name && <> · last edit {note.updated_by_name}, {timeAgo(note.updated_at)}</>}
        </p>

        <div className="mt-4 flex flex-wrap gap-1 rounded-md border border-line p-1 text-xs">
          {COLUMNS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => update({ board_column: c.id, position: Date.now() / 1000 })}
              className={`flex-1 rounded px-2 py-1.5 font-display uppercase tracking-wide ${note.board_column === c.id ? 'bg-raised text-text' : 'text-muted hover:text-text'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Club</span>
            <select value={note.club_id ?? ''} onChange={(e) => update({ club_id: e.target.value || null })} className={input}>
              <option value="">-</option>
              {clubs?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Due</span>
            <input type="date" value={note.due_on ?? ''} onChange={(e) => update({ due_on: e.target.value || null })} className={input} />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={note.pinned} onChange={(e) => update({ pinned: e.target.checked })} className="h-4 w-4 accent-[#c8b98c]" />
          Pin to the top
        </label>

        <label className="mt-4 block">
          <span className={label}>Text</span>
          <textarea
            value={body}
            rows={8}
            maxLength={20000}
            onChange={(e) => setBody(e.target.value)}
            onBlur={saveText}
            placeholder="Write anything..."
            className="mt-1 w-full rounded-md border border-line bg-ink p-3 text-sm leading-relaxed text-text outline-none focus:border-straw"
          />
        </label>
        {dirty && (
          <button type="button" onClick={saveText} className="mt-2 self-start rounded-md bg-straw px-3 py-1.5 font-display text-xs uppercase tracking-wide text-ink">
            Save text
          </button>
        )}

        {/* Links */}
        <section className="mt-6">
          <h3 className={label}>Links</h3>
          <ul className="mt-2 space-y-1">
            {note.links.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2 text-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate text-straw hover:underline">
                  🔗 {l.label}
                </a>
                <button type="button" onClick={() => update({ links: note.links.filter((_, j) => j !== i) })} className="text-xs text-muted hover:text-hanko-text" aria-label="Remove link">
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addLink} className="mt-2 flex gap-2">
            <input value={link.label} onChange={(e) => setLink((l) => ({ ...l, label: e.target.value }))} placeholder="Name" className={`${input} mt-0 w-1/3`} />
            <input value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} placeholder="https://..." className={`${input} mt-0 flex-1`} />
            <button type="submit" className="rounded-md border border-line px-3 text-sm text-muted hover:text-text">+</button>
          </form>
        </section>

        {/* Files */}
        <section
          className={`mt-6 rounded-lg border border-dashed p-3 transition-colors ${dropping ? 'border-straw bg-raised/60' : 'border-line'}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDropping(true)
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDropping(false)
            if (e.dataTransfer.files.length) upload.mutate([...e.dataTransfer.files])
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className={label}>Files & images</h3>
            <button type="button" onClick={() => fileInput.current?.click()} className="text-xs text-straw hover:underline">
              {upload.isPending ? 'uploading...' : '+ add (or drop here)'}
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && upload.mutate([...e.target.files])} />
          </div>
          {upload.isError && <p className="mt-2 text-xs text-hanko-text">{(upload.error as Error).message}</p>}
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((f) => (
                <button key={f.id} type="button" onClick={() => openPrivateFile(f.path)} className="aspect-square overflow-hidden rounded-md bg-ink">
                  {thumbs?.[f.path] && <img src={thumbs[f.path]} alt={f.name} className="h-full w-full object-cover transition-transform hover:scale-105" />}
                </button>
              ))}
            </div>
          )}
          <ul className="mt-2 space-y-1">
            {detail?.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <button type="button" onClick={() => openPrivateFile(f.path)} className="truncate text-left text-text hover:text-straw">
                  📎 {f.name}
                </button>
                <span className="shrink-0 text-[11px] text-muted">
                  {f.author_name} · {timeAgo(f.created_at)}
                  <button type="button" onClick={() => window.confirm(`Delete ${f.name}?`) && delFile.mutate(f)} className="ml-2 hover:text-hanko-text" aria-label="Delete file">
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Comments */}
        <section className="mt-6">
          <h3 className={label}>Comments</h3>
          <ul className="mt-2 space-y-2">
            {detail?.comments.map((c) => (
              <li key={c.id} className="group rounded-md bg-ink p-3">
                <p className="flex justify-between text-[11px] text-muted">
                  <span>
                    <Author name={c.author_name} /> · {timeAgo(c.created_at)}
                  </span>
                  <button type="button" onClick={() => delComment.mutate(c.id)} className="opacity-0 transition-opacity hover:text-hanko-text group-hover:opacity-100" aria-label="Delete comment">
                    ✕
                  </button>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-text">{c.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={sendComment} className="mt-2 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment..." maxLength={4000} className={`${input} mt-0 flex-1`} />
            <button type="submit" disabled={addComment.isPending} className="rounded-md bg-raised px-4 text-sm text-text hover:bg-line">
              Send
            </button>
          </form>
        </section>

        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Delete this note with its files and comments?')) return
            await remove.mutateAsync(note.id)
            onClose()
          }}
          className="mt-8 self-start text-xs uppercase tracking-wide text-muted hover:text-hanko-text"
        >
          Delete note
        </button>
      </aside>
    </div>
  )
}
