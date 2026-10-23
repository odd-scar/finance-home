import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { addNote, updateNote, removeNote, togglePinNote } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField } from '../ui/FormField'
import { Plus, Trash2, Edit2, Pin, PinOff, StickyNote, Search, X, Tag } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Note } from '../../types'

const emptyForm = { title: '', body: '', tagInput: '', tags: [] as string[] }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Notes() {
  const { notes } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editNote, setEditNote] = useState<Note | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Collect all unique tags across notes
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort()

  // Filter notes by search and active tag
  const filtered = notes
    .filter(n => {
      const q = search.toLowerCase()
      const matchesSearch = !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))
      const matchesTag = !activeTag || n.tags.includes(activeTag)
      return matchesSearch && matchesTag
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const handleAddTag = () => {
    const tag = form.tagInput.trim().toUpperCase()
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag], tagInput: '' }))
    } else {
      setForm(f => ({ ...f, tagInput: '' }))
    }
  }

  const handleRemoveTag = (tag: string) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))

  const handleAdd = () => {
    if (!form.title.trim()) return
    const now = new Date().toISOString()
    addNote({ id: uuid(), title: form.title.trim(), body: form.body.trim(), tags: form.tags, pinned: false, addedAt: now, updatedAt: now })
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editNote) return
    updateNote(editNote.id, { title: form.title.trim(), body: form.body.trim(), tags: form.tags })
    setEditNote(null)
    setForm({ ...emptyForm })
  }

  const openEdit = (n: Note) => {
    setEditNote(n)
    setForm({ title: n.title, body: n.body, tagInput: '', tags: [...n.tags] })
  }

  const noteFormJsx = (
    <div className="space-y-4">
      <FormField label="Title">
        <Input
          placeholder="e.g. AAPL allocation thoughts"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </FormField>
      <FormField label="Note" hint="Your full thoughts — allocation amounts, thesis, reminders, anything.">
        <textarea
          rows={6}
          placeholder="Write your note here…"
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </FormField>
      <FormField label="Tags" hint="Tag by ticker (AAPL), topic (allocation), or anything useful. Press Enter or comma to add.">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-brand-600/20 text-brand-300 text-xs px-2 py-1 rounded-full font-medium">
              {tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-rose-400 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="AAPL, allocation…"
            value={form.tagInput}
            onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag() } }}
          />
          <Button variant="secondary" onClick={handleAddTag} className="shrink-0">Add</Button>
        </div>
      </FormField>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Notes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{notes.length} {notes.length === 1 ? 'note' : 'notes'} · tag by ticker, topic, or anything</p>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}>
          <Plus size={14} /> New Note
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-all ${
                activeTag === tag
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Tag size={10} />
              {tag}
            </button>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs text-gray-500 hover:text-white underline px-1">
              clear
            </button>
          )}
        </div>
      )}

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
          <StickyNote size={40} className="opacity-25" />
          <p className="text-sm text-center">No notes yet. Jot down stock thoughts, allocation plans, watchlist reminders — anything.</p>
          <Button onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }} variant="secondary">
            <Plus size={14} /> Write your first note
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
          <p className="text-sm">No notes match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(note => (
            <div
              key={note.id}
              className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 transition-all ${
                note.pinned ? 'border-brand-600/50 shadow-md shadow-brand-600/10' : 'border-gray-800'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {note.pinned && <Pin size={12} className="text-brand-400 shrink-0" />}
                  <p className="font-semibold text-white text-sm truncate">{note.title}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => togglePinNote(note.id)}
                    className={`p-1.5 rounded-lg transition-colors ${note.pinned ? 'text-brand-400 hover:bg-brand-600/10' : 'text-gray-600 hover:text-brand-400 hover:bg-gray-800'}`}
                    title={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button onClick={() => openEdit(note)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-600 hover:text-white transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => removeNote(note.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-600 hover:text-rose-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Body preview */}
              {note.body && (
                <p className="text-sm text-gray-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">{note.body}</p>
              )}

              {/* Tags */}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-400 font-medium hover:bg-brand-600/30 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Date */}
              <p className="text-[10px] text-gray-600 mt-auto">
                {note.addedAt === note.updatedAt ? `Added ${formatDate(note.addedAt)}` : `Edited ${formatDate(note.updatedAt)}`}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="New Note"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} className="flex-1">Save Note</Button>
          </div>
        }
      >{noteFormJsx}</Modal>

      <Modal
        open={!!editNote}
        onClose={() => { setEditNote(null); setForm({ ...emptyForm }) }}
        title="Edit Note"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setEditNote(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button>
            <Button onClick={handleEdit} className="flex-1">Save Changes</Button>
          </div>
        }
      >{noteFormJsx}</Modal>
    </div>
  )
}
