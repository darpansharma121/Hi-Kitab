import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowDownLeft, ArrowUpRight, Boxes, BrickWall, CalendarDays, Check, ChevronDown,
  ClipboardList, Cloud, FileDown, Filter, HardHat, IndianRupee, Landmark,
  Mic, Pencil, Plus, Printer, Search, Send, Settings2, Speech, Trash2, Truck,
  Wallet, X,
} from 'lucide-react'
import './App.css'

type Section = 'daily' | 'hazira' | 'payment' | 'loading' | 'debt' | 'stock' | 'monthly'
type BrickLoadLine = { size: string; quantity: number }
type RecordEntry = {
  id: string
  type: Section
  date: string
  description: string
  category: string
  received: number
  spent: number
  personName: string
  wage: number
  rate: number
  attendance: string
  vehicle: string
  size: string
  quantity: number
  amount: number
  paid: number
  opening: number
  produced: number
  sold: number
  loads: BrickLoadLine[]
}

const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = localDateString(new Date())
const storageKey = 'hi-kitab-records-v1'
const ownerStorageKey = 'hi-kitab-owner-v1'
const sectionMeta: Record<Section, { title: string; subtitle: string; icon: typeof ClipboardList; color: string }> = {
  daily: { title: 'Daily notebook', subtitle: 'Cash in, cash out, and daily notes', icon: ClipboardList, color: 'green' },
  hazira: { title: 'Hazira / labour', subtitle: 'Attendance, rates, and wages', icon: HardHat, color: 'orange' },
  payment: { title: 'Payments', subtitle: 'Wage and advance payment history', icon: Wallet, color: 'blue' },
  loading: { title: 'Loading register', subtitle: 'Trips, vehicles, sizes, and quantities', icon: Truck, color: 'clay' },
  debt: { title: 'Debt register', subtitle: 'Customer balances and repayments', icon: Landmark, color: 'rose' },
  stock: { title: 'Brick stock', subtitle: 'Production, sales, and stock on hand', icon: Boxes, color: 'teal' },
  monthly: { title: 'Monthly detail', subtitle: 'A clear view of the month’s accounts', icon: CalendarDays, color: 'gold' },
}
const sections = Object.keys(sectionMeta) as Section[]
const quickSections: Section[] = ['daily', 'hazira', 'payment', 'loading', 'debt']
const categories = ['Sales', 'Fuel', 'Materials', 'Transport', 'Food', 'Repairs', 'Other']
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
const blankRecord = (type: Section): RecordEntry => ({
  id: '', type, date: today, description: '', category: type === 'payment' ? 'Wages' : type === 'hazira' ? 'Labour' : categories[0], received: 0, spent: 0,
  personName: '', wage: 0, rate: 0, attendance: 'Present', vehicle: '', size: 'Standard',
  quantity: 0, amount: 0, paid: 0, opening: 0, produced: 0, sold: 0,
  loads: [{ size: 'Standard', quantity: 0 }],
})
const initialRecords = (): RecordEntry[] => {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as RecordEntry[] } catch { return [] }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
const isPublicSupabaseKey = (key: string) => {
  if (key.startsWith('sb_publishable_')) return true
  try {
    const payload = key.split('.')[1]
    if (!payload) return false
    const claims = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))) as { role?: string }
    return claims.role === 'anon'
  } catch {
    return false
  }
}
const supabaseKeyIsPublic = Boolean(supabasePublicKey && isPublicSupabaseKey(supabasePublicKey))
const supabaseConfigIssue = supabasePublicKey && !supabaseKeyIsPublic
  ? 'This key is not a publishable/anon key. Remove it from browser configuration. Service-role and secret keys must only be used by a trusted server.'
  : null
const supabase = supabaseUrl && supabasePublicKey && supabaseKeyIsPublic ? createClient(supabaseUrl, supabasePublicKey) : null

function App() {
  const [records, setRecords] = useState<RecordEntry[]>(initialRecords)
  const [section, setSection] = useState<Section>('daily')
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(today.slice(0, 7))
  const [form, setForm] = useState<RecordEntry | null>(null)
  const [notice, setNotice] = useState('')
  const [cloudState, setCloudState] = useState<'local' | 'connected' | 'syncing'>('local')
  const [loginOpen, setLoginOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN')
  const [displayDate] = useState(() => new Date())

  useEffect(() => {
    if (!supabase) return
    let active = true
    let syncStarted = false
    const syncCloud = async (session: { user: { id: string; email?: string } }) => {
      if (syncStarted) return
      syncStarted = true
      setSignedIn(true)
      setEmail(session.user.email ?? '')
      setCloudState('syncing')
      const { data: rows, error } = await supabase.from('factory_records').select('payload').order('created_at', { ascending: false })
      if (!active) return
      if (!error && rows) {
        const remote = rows.map((row) => row.payload as RecordEntry)
        const knownIds = new Set(remote.map((record) => record.id))
        const localOwner = localStorage.getItem(ownerStorageKey)
        const canMigrateLocal = !localOwner || localOwner === session.user.id
        const localOnly = canMigrateLocal ? initialRecords().filter((record) => !knownIds.has(record.id)) : []
        const merged = [...remote, ...localOnly]
        setRecords(merged)
        localStorage.setItem(storageKey, JSON.stringify(merged))
        localStorage.setItem(ownerStorageKey, session.user.id)
        if (localOnly.length) {
          const { error: uploadError } = await supabase.from('factory_records').upsert(localOnly.map((record) => ({ id: record.id, type: record.type, date: record.date, payload: record })))
          setCloudState(uploadError ? 'local' : 'connected')
          return
        }
      }
      setCloudState(error ? 'local' : 'connected')
    }
    supabase.auth.getSession().then(({ data }) => { if (data.session) void syncCloud(data.session) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (session && event !== 'SIGNED_OUT') void syncCloud(session)
      if (!session) {
        syncStarted = false
        setSignedIn(false)
        setEmail('')
        setCloudState('local')
      }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(records)) }, [records])

  const monthRecords = useMemo(() => records.filter((record) => record.date.startsWith(monthFilter)), [records, monthFilter])
  const receivedTotal = monthRecords.reduce((sum, item) => sum + item.received + (item.type === 'debt' ? item.paid : 0), 0)
  const spentTotal = monthRecords.reduce((sum, item) => sum + item.spent + (item.type === 'payment' ? item.amount : 0), 0)
  const wagesTotal = monthRecords.reduce((sum, item) => sum + (item.type === 'hazira' ? item.wage : 0), 0)
  const cashBalance = monthRecords.reduce((sum, item) => sum + item.received + (item.type === 'debt' ? item.paid : 0) - item.spent - (item.type === 'payment' ? item.amount : 0), 0)
  const outstanding = records.filter((item) => item.type === 'debt').reduce((sum, item) => sum + Math.max(item.amount - item.paid, 0), 0)
  const monthlyProfit = receivedTotal - monthRecords.reduce((sum, item) => sum + item.spent, 0) - wagesTotal
  const filteredRecords = useMemo(() => records.filter((record) => {
    const matchSection = section === 'monthly' || record.type === section
    const matchSource = sourceFilter === 'all' || record.type === sourceFilter
    const matchMonth = record.date.startsWith(monthFilter)
    const text = `${record.description} ${record.personName} ${record.category} ${record.vehicle} ${record.size}`.toLowerCase()
    return matchSection && matchSource && matchMonth && text.includes(query.toLowerCase())
  }).sort((a, b) => b.date.localeCompare(a.date)), [records, section, sourceFilter, monthFilter, query])

  const persistRemote = async (record: RecordEntry, remove = false) => {
    if (!supabase || !signedIn) return
    setCloudState('syncing')
    const result = remove
      ? await supabase.from('factory_records').delete().eq('id', record.id)
      : await supabase.from('factory_records').upsert({ id: record.id, type: record.type, date: record.date, payload: record })
    setCloudState(result.error ? 'local' : 'connected')
    if (result.error) setNotice(`Cloud sync failed: ${result.error.message}`)
  }

  const saveRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    const saved = { ...form, id: form.id || crypto.randomUUID() }
    setRecords((current) => form.id ? current.map((item) => item.id === form.id ? saved : item) : [saved, ...current])
    void persistRemote(saved)
    setForm(null)
    setNotice('Record saved')
    window.setTimeout(() => setNotice(''), 2800)
  }

  const removeRecord = (record: RecordEntry) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    setRecords((current) => current.filter((item) => item.id !== record.id))
    void persistRemote(record, true)
  }

  const startVoice = (field: 'description' | 'personName') => {
    type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
    type SpeechRecognizer = { lang: string; interimResults: boolean; onresult: ((event: SpeechResultEvent) => void) | null; onerror: (() => void) | null; start: () => void }
    type SpeechRecognitionCtor = new () => SpeechRecognizer
    const SpeechRecognitionApi = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
    if (!SpeechRecognitionApi) { setNotice('Voice input is not available in this browser'); return }
    const recognition = new SpeechRecognitionApi()
    recognition.lang = voiceLanguage
    recognition.interimResults = false
    recognition.onresult = (event) => setForm((current) => current ? { ...current, [field]: `${current[field]} ${event.results[0][0].transcript}`.trim() } : current)
    recognition.onerror = () => setNotice('Could not hear that. Please try again.')
    recognition.start()
  }

  const exportCsv = () => {
    const headers = ['Date', 'Register', 'Description', 'Category', 'Person', 'Received', 'Spent', 'Amount', 'Paid', 'Balance', 'Vehicle', 'Brick size', 'Quantity']
    const rows = filteredRecords.map((record) => [record.date, sectionMeta[record.type].title, record.description, record.category, record.personName, record.received, record.spent, record.amount, record.paid, Math.max(record.amount - record.paid, 0), record.vehicle, record.type === 'loading' ? (record.loads ?? []).map((line) => `${line.size}: ${line.quantity}`).join('; ') : record.size, record.type === 'loading' ? (record.loads ?? []).reduce((sum, line) => sum + line.quantity, 0) : record.quantity])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hi-kitab-${section}-${today}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const sendSms = () => {
    const text = `Hi, ${sectionMeta[section].title} update for ${displayDate.toLocaleDateString('en-IN')}. Received: ${money(receivedTotal)}. Spent: ${money(spentTotal)}. Outstanding debt: ${money(outstanding)}.`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self')
  }

  const readSummary = () => {
    if (!('speechSynthesis' in window)) { setNotice('Speech playback is not available in this browser'); return }
    const text = voiceLanguage === 'hi-IN'
      ? `इस महीने कुल प्राप्त राशि ${receivedTotal} रुपये है। कुल खर्च ${spentTotal} रुपये है। बकाया उधार ${outstanding} रुपये है।`
      : `This month, money received is ${receivedTotal} rupees. Money spent is ${spentTotal} rupees. Outstanding debt is ${outstanding} rupees.`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voiceLanguage
    window.speechSynthesis.speak(utterance)
  }

  const update = (key: keyof RecordEntry, value: string | number) => setForm((current) => {
    if (!current) return current
    const next = { ...current, [key]: value }
    if (next.type === 'hazira' && (key === 'rate' || key === 'attendance')) {
      next.wage = next.attendance === 'Absent' ? 0 : next.attendance === 'Half day' ? next.rate / 2 : next.rate
    }
    return next
  })
  const updateLoadLine = (index: number, key: keyof BrickLoadLine, value: string | number) => setForm((current) => current ? {
    ...current,
    loads: (current.loads ?? [{ size: current.size, quantity: current.quantity }]).map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
  } : current)
  const changeLoadLineCount = (count: number) => setForm((current) => {
    if (!current) return current
    const lines = current.loads ?? [{ size: current.size, quantity: current.quantity }]
    return { ...current, loads: count > lines.length ? [...lines, { size: 'Standard', quantity: 0 }] : lines.filter((_, index) => index !== count) }
  })
  const inputClass = 'field-input'
  const activeMeta = sectionMeta[section]
  const ActiveIcon = activeMeta.icon

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <button className="brand" onClick={() => setSection('daily')} aria-label="Hi-Kitab home">
          <span className="brand-mark"><BrickWall size={19} strokeWidth={1.8} /></span>
          <span>hi-kitab<span className="brand-period">.</span></span>
        </button>
        <div className="topbar-right">
          <div className={`sync-status ${cloudState}`}><span className="status-dot" />{cloudState === 'connected' ? 'Synced' : cloudState === 'syncing' ? 'Syncing' : 'On this device'}</div>
          <button className="icon-button" title="Account and sync" onClick={() => setLoginOpen(true)}><Settings2 size={18} /></button>
          <span className="avatar">{signedIn ? email.slice(0, 1).toUpperCase() : 'M'}</span>
        </div>
      </header>

      <main className="main-content">
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="live-mark" /> FACTORY BOOK</div>
            <h1>Good morning, Manager.</h1>
            <p className="welcome-copy">Your books, in order. <span>{displayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
          </div>
          <button className="primary-button new-entry no-print" onClick={() => setForm(blankRecord(section))}><Plus size={17} /> New entry</button>
        </section>

        <section className="summary-grid" aria-label="Monthly summary">
          <Summary icon={<ArrowDownLeft size={16} />} label="Money received" value={money(receivedTotal)} tone="green" note="this month" />
          <Summary icon={<ArrowUpRight size={16} />} label="Money spent" value={money(spentTotal)} tone="orange" note="this month" />
          <Summary icon={<Landmark size={16} />} label="Debt outstanding" value={money(outstanding)} tone="blue" note="across customers" />
          <Summary icon={<IndianRupee size={16} />} label="Month balance" value={money(monthlyProfit)} tone={monthlyProfit >= 0 ? 'green' : 'orange'} note={monthlyProfit >= 0 ? 'estimated surplus' : 'estimated shortfall'} />
        </section>

        <section className="quick-section no-print">
          <div className="section-heading">
            <div><div className="eyebrow">YOUR WORKSPACE</div><h2>Open a register</h2></div>
            <button className="text-action" onClick={() => setSection('monthly')}>Monthly overview <ChevronDown size={15} /></button>
          </div>
          <div className="quick-grid">
            {quickSections.map((key) => {
              const item = sectionMeta[key]
              const Icon = item.icon
              return <button key={key} className={`quick-card ${section === key ? 'selected' : ''}`} onClick={() => setSection(key)}>
                <span className={`quick-icon ${item.color}`}><Icon size={19} strokeWidth={1.8} /></span>
                <span className="quick-title">{item.title}</span><span className="quick-arrow">↗</span>
              </button>
            })}
            {sections.filter((key) => !quickSections.includes(key)).map((key) => {
              const item = sectionMeta[key]
              const Icon = item.icon
              return <button key={key} className={`quick-card secondary-card ${section === key ? 'selected' : ''}`} onClick={() => setSection(key)}>
                <span className={`quick-icon ${item.color}`}><Icon size={19} strokeWidth={1.8} /></span>
                <span className="quick-title">{item.title}</span><span className="quick-arrow">↗</span>
              </button>
            })}
          </div>
        </section>

        <section className="register-section">
          <div className="register-title-row">
            <div className="register-title-wrap">
              <span className={`register-heading-icon ${activeMeta.color}`}><ActiveIcon size={17} /></span>
              <div><h2>{activeMeta.title}</h2><p>{activeMeta.subtitle}</p></div>
            </div>
            <div className="toolbar no-print">
              <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entries" /></label>
              <button className="toolbar-button" title="Export CSV" onClick={exportCsv}><FileDown size={16} /><span>CSV</span></button>
              <button className="toolbar-button" title="Print report" onClick={() => window.print()}><Printer size={16} /><span>Print</span></button>
              <button className="toolbar-button" title="SMS summary" onClick={sendSms}><Send size={16} /><span>SMS</span></button>
              <button className="toolbar-button" title="Read summary aloud" onClick={readSummary}><Speech size={16} /><span>Read</span></button>
            </div>
          </div>

          <div className="filters no-print">
            <label className="filter-label"><Filter size={14} /><span>Filter</span></label>
            <select aria-label="Filter by register" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All registers</option>{sections.map((key) => <option key={key} value={key}>{sectionMeta[key].title}</option>)}
            </select>
            <label className="date-filter"><CalendarDays size={14} /><input aria-label="Select month" type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} /></label>
            <span className="result-count">{filteredRecords.length} {filteredRecords.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          {section === 'monthly' && <div className="report-strip">
            <ReportValue label="Sales & receipts" value={money(receivedTotal)} /><ReportValue label="Expenses" value={money(monthRecords.reduce((sum, item) => sum + item.spent, 0))} />
            <ReportValue label="Wages recorded" value={money(wagesTotal)} /><ReportValue label="Check balance" value={money(cashBalance)} />
            <ReportValue label="Estimated result" value={money(monthlyProfit)} />
          </div>}

          {filteredRecords.length === 0 ? <div className="empty-state">
            <span className="empty-icon"><ClipboardList size={23} /></span><h3>No entries here yet</h3>
            <p>Start today's paperless record with a new entry.</p><button className="secondary-button no-print" onClick={() => setForm(blankRecord(section))}><Plus size={15} /> Add first entry</button>
          </div> : <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Details</th><th>Register</th><th className="numeric">Received</th><th className="numeric">Spent</th><th className="numeric">Balance / Qty</th><th className="no-print">Edit</th></tr></thead>
              <tbody>{filteredRecords.map((record) => <tr key={record.id}>
                <td className="date-cell">{new Date(`${record.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td><div className="detail-primary">{record.description || record.personName || record.vehicle || record.size}</div><div className="detail-secondary">{record.personName ? `${record.personName} · ` : ''}{record.category}</div></td>
                <td><span className="type-pill">{sectionMeta[record.type].title}</span></td>
                <td className="numeric amount-in">{record.received || record.type === 'debt' && record.paid ? money(record.received + (record.type === 'debt' ? record.paid : 0)) : '—'}</td>
                <td className="numeric amount-out">{record.type === 'hazira' ? money(record.wage) : record.spent || record.type === 'payment' ? money(record.spent + record.amount) : '—'}</td>
                <td className="numeric">{record.type === 'debt' ? money(Math.max(record.amount - record.paid, 0)) : record.type === 'stock' ? `${(record.opening + record.produced - record.sold).toLocaleString('en-IN')} bricks` : record.type === 'loading' ? `${(record.loads ?? [{ size: record.size, quantity: record.quantity }]).reduce((sum, line) => sum + line.quantity, 0).toLocaleString('en-IN')} bricks` : record.quantity ? `${record.quantity.toLocaleString('en-IN')} bricks` : '—'}</td>
                <td className="no-print"><div className="row-actions"><button title="Edit record" onClick={() => setForm({ ...record })}><Pencil size={15} /></button><button title="Delete record" onClick={() => removeRecord(record)}><Trash2 size={15} /></button></div></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>

        <footer className="footer-note"><span>HI-KITAB · FACTORY REGISTER</span><span>{cloudState === 'connected' ? 'Backed up to your Supabase project' : 'Records are saved on this device'} <Cloud size={13} /></span></footer>
      </main>

      {form && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}>
        <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
          <div className="modal-header"><div><div className="eyebrow">FACTORY REGISTER</div><h2 id="entry-title">{form.id ? 'Edit entry' : 'New entry'}</h2></div><div className="modal-tools"><div className="language-toggle" aria-label="Voice language"><button type="button" className={voiceLanguage === 'en-IN' ? 'active' : ''} onClick={() => setVoiceLanguage('en-IN')}>EN</button><button type="button" className={voiceLanguage === 'hi-IN' ? 'active' : ''} onClick={() => setVoiceLanguage('hi-IN')}>हि</button></div><button className="icon-button" onClick={() => setForm(null)} aria-label="Close"><X size={19} /></button></div></div>
          <div className="section-picker">{sections.map((key) => { const Icon = sectionMeta[key].icon; return <button key={key} className={form.type === key ? 'active' : ''} onClick={() => update('type', key)}><Icon size={15} />{sectionMeta[key].title}</button> })}</div>
          <form onSubmit={saveRecord}>
            <div className="form-grid">
              <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></Field>
              {form.type === 'daily' && <>
                <Field label="Category"><select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
                <Field label="Money received (₹)"><input className={inputClass} type="number" min="0" value={form.received || ''} onChange={(event) => update('received', Number(event.target.value))} /></Field>
                <Field label="Money spent (₹)"><input className={inputClass} type="number" min="0" value={form.spent || ''} onChange={(event) => update('spent', Number(event.target.value))} /></Field>
              </>}
              {form.type === 'hazira' && <>
                <Field label="Worker name"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice('personName')} /></Field>
                <Field label="Attendance"><select className={inputClass} value={form.attendance} onChange={(event) => update('attendance', event.target.value)}><option>Present</option><option>Half day</option><option>Absent</option></select></Field>
                <Field label="Daily rate (₹)"><input className={inputClass} type="number" min="0" value={form.rate || ''} onChange={(event) => update('rate', Number(event.target.value))} /></Field>
                <Field label="Wage due (₹)"><input className={inputClass} type="number" min="0" value={form.wage || ''} onChange={(event) => update('wage', Number(event.target.value))} /></Field>
              </>}
              {form.type === 'payment' && <>
                <Field label="Worker / payee"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice('personName')} /></Field>
                <Field label="Payment type"><select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value)}><option>Wages</option><option>Advance</option><option>Other</option></select></Field>
                <Field label="Amount paid (₹)"><input className={inputClass} type="number" min="0" value={form.amount || ''} onChange={(event) => update('amount', Number(event.target.value))} /></Field>
                <Field label="Wage due (₹)"><input className={inputClass} type="number" min="0" value={form.wage || ''} onChange={(event) => update('wage', Number(event.target.value))} /></Field>
                <div className="balance-hint field-wide">Balance after this payment <strong>{money(Math.max(form.wage - form.amount, 0))}</strong></div>
              </>}
              {form.type === 'loading' && <>
                <Field label="Vehicle number"><input className={inputClass} value={form.vehicle} onChange={(event) => update('vehicle', event.target.value)} placeholder="e.g. AS 01 AB 1234" /></Field>
                <Field label="Trip / customer"><input className={inputClass} value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>
                <div className="field field-wide"><span>Brick sizes and quantities</span><div className="load-lines">{(form.loads ?? [{ size: form.size, quantity: form.quantity }]).map((line, index) => <div className="load-line" key={index}>
                  <select className={inputClass} aria-label={`Brick size ${index + 1}`} value={line.size} onChange={(event) => updateLoadLine(index, 'size', event.target.value)}><option>Standard</option><option>First class</option><option>Second class</option><option>Half brick</option><option>Custom</option></select>
                  <input className={inputClass} aria-label={`Quantity ${index + 1}`} type="number" min="0" value={line.quantity || ''} onChange={(event) => updateLoadLine(index, 'quantity', Number(event.target.value))} placeholder="Quantity" />
                  <button type="button" className="remove-load-line" aria-label={`Remove brick size ${index + 1}`} disabled={(form.loads ?? [{ size: form.size, quantity: form.quantity }]).length < 2} onClick={() => changeLoadLineCount(index)}><X size={15} /></button>
                </div>)}</div><button type="button" className="add-load-line" onClick={() => changeLoadLineCount((form.loads ?? [{ size: form.size, quantity: form.quantity }]).length + 1)}><Plus size={14} /> Add brick size</button></div>
                <div className="balance-hint field-wide">Total bricks on this trip <strong>{(form.loads ?? [{ size: form.size, quantity: form.quantity }]).reduce((sum, line) => sum + line.quantity, 0).toLocaleString('en-IN')}</strong></div>
              </>}
              {form.type === 'debt' && <>
                <Field label="Customer name"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice('personName')} /></Field>
                <Field label="Description"><input className={inputClass} value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>
                <Field label="Total amount (₹)"><input className={inputClass} type="number" min="0" value={form.amount || ''} onChange={(event) => update('amount', Number(event.target.value))} /></Field>
                <Field label="Paid so far (₹)"><input className={inputClass} type="number" min="0" value={form.paid || ''} onChange={(event) => update('paid', Number(event.target.value))} /></Field>
              </>}
              {form.type === 'stock' && <>
                <Field label="Brick size"><select className={inputClass} value={form.size} onChange={(event) => update('size', event.target.value)}><option>Standard</option><option>First class</option><option>Second class</option><option>Half brick</option><option>Custom</option></select></Field>
                <Field label="Opening stock"><input className={inputClass} type="number" min="0" value={form.opening || ''} onChange={(event) => update('opening', Number(event.target.value))} /></Field>
                <Field label="Bricks produced"><input className={inputClass} type="number" min="0" value={form.produced || ''} onChange={(event) => update('produced', Number(event.target.value))} /></Field>
                <Field label="Bricks sold"><input className={inputClass} type="number" min="0" value={form.sold || ''} onChange={(event) => update('sold', Number(event.target.value))} /></Field>
              </>}
              {form.type === 'monthly' && <Field label="Month note"><input className={inputClass} value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>}
              <Field label="Notes / description" wide><VoiceInput value={form.description} onChange={(value) => update('description', value)} onVoice={() => startVoice('description')} multiline /></Field>
            </div>
            {form.type === 'debt' && <div className="balance-hint">Outstanding after payment <strong>{money(Math.max(form.amount - form.paid, 0))}</strong></div>}
            {form.type === 'stock' && <div className="balance-hint">Estimated closing stock <strong>{(form.opening + form.produced - form.sold).toLocaleString('en-IN')} bricks</strong></div>}
            <div className="form-footer"><button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button><button type="submit" className="primary-button"><Check size={16} /> Save entry</button></div>
          </form>
        </section>
      </div>}

      {loginOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginOpen(false) }}>
        <section className="entry-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
          <div className="modal-header"><div><div className="eyebrow">BACKUP & ACCESS</div><h2 id="account-title">Cloud sync</h2></div><button className="icon-button" onClick={() => setLoginOpen(false)} aria-label="Close"><X size={19} /></button></div>
          {!supabase ? <p className="account-copy">{supabaseConfigIssue ?? <>Supabase is not configured. Your records are saved in this browser. Add the project URL and a publishable/anon key in <code>.env.local</code> to enable owner sign-in and cloud backup.</>}</p> : signedIn ? <><p className="account-copy">Signed in as <strong>{email || 'factory owner'}</strong>. Your records sync to your private factory workspace.</p><button className="secondary-button" onClick={async () => { await supabase.auth.signOut(); setSignedIn(false); setCloudState('local'); setLoginOpen(false) }}>Sign out</button></> : <form onSubmit={async (event) => { event.preventDefault(); const { error } = await supabase.auth.signInWithOtp({ email }); setNotice(error ? error.message : 'Sign-in link sent. Check your email.'); if (!error) setLoginOpen(false) }}><p className="account-copy">Sign in with your email to back up this factory’s records securely.</p><Field label="Owner email"><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field><button className="primary-button account-submit" type="submit"><Send size={16} /> Email sign-in link</button></form>}
        </section>
      </div>}

      {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
    </div>
  )
}

function Summary({ icon, label, value, tone, note }: { icon: ReactNode; label: string; value: string; tone: string; note: string }) {
  return <article className="summary-card"><span className={`summary-icon ${tone}`}>{icon}</span><div className="summary-content"><span className="summary-label">{label}</span><strong>{value}</strong><span className="summary-note">{note}</span></div></article>
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'field-wide' : ''}`}><span>{label}</span>{children}</label>
}

function VoiceInput({ value, onChange, onVoice, multiline = false }: { value: string; onChange: (value: string) => void; onVoice: () => void; multiline?: boolean }) {
  return <span className="voice-input">{multiline ? <textarea className="field-input" rows={3} value={value} onChange={(event) => onChange(event.target.value)} /> : <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />}<button type="button" title="Dictate in English or Hindi" onClick={onVoice}><Mic size={16} /></button></span>
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return <div className="report-value"><span>{label}</span><strong>{value}</strong></div>
}

export default App