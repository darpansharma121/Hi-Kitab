import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowDownLeft, ArrowUpRight, Boxes, BrickWall, CalendarDays, Check, ChevronDown,
  ClipboardList, Cloud, FileDown, Filter, HardHat, History, IndianRupee, Landmark,
  Mic, Pencil, Phone, Plus, Printer, Search, Send, Settings2, Speech, Trash2, Truck,
  UserPlus, Users, Wallet, X,
} from 'lucide-react'
import './App.css'

export type Section = 'daily' | 'labor' | 'hazira' | 'payment' | 'loading' | 'debt' | 'stock' | 'monthly'
export type BrickLoadLine = { size: string; quantity: number }

export type RecordEntry = {
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

export type Laborer = {
  id: string
  name: string
  role: string
  dailyRate: number
  phone: string
  joinDate: string
  status: 'Active' | 'Inactive'
  notes?: string
}

export type LaborEntry = {
  id: string
  laborerId: string
  laborerName: string
  date: string
  workDone: string
  attendance: 'Present' | 'Half day' | 'Absent' | 'Overtime'
  wage: number
  rate: number
  moneyTaken: number
  paymentType?: 'Advance' | 'Weekly Kharcha' | 'Wages' | 'Other'
  notes?: string
}

const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = localDateString(new Date())

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateString(d)
}

const getWeekRange = (dateStr: string = today) => {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    startStr: localDateString(monday),
    endStr: localDateString(sunday),
    display: `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
  }
}

const storageKey = 'hi-kitab-records-v1'
const ownerStorageKey = 'hi-kitab-owner-v1'
const laborersStorageKey = 'hi-kitab-laborers-v2'
const laborEntriesStorageKey = 'hi-kitab-labor-entries-v2'

const sectionMeta: Record<Section, { title: string; subtitle: string; icon: typeof ClipboardList; color: string }> = {
  daily: { title: 'Daily notebook', subtitle: 'Cash in, cash out, and daily notes', icon: ClipboardList, color: 'green' },
  labor: { title: 'Labor register', subtitle: 'Worker registry, daily money, tasks & totals', icon: Users, color: 'clay' },
  hazira: { title: 'Hazira / attendance', subtitle: 'Attendance, rates, and wages', icon: HardHat, color: 'orange' },
  payment: { title: 'Payments', subtitle: 'Wage and advance payment history', icon: Wallet, color: 'blue' },
  loading: { title: 'Loading register', subtitle: 'Trips, vehicles, sizes, and quantities', icon: Truck, color: 'clay' },
  debt: { title: 'Debt register', subtitle: 'Customer balances and repayments', icon: Landmark, color: 'rose' },
  stock: { title: 'Brick stock', subtitle: 'Production, sales, and stock on hand', icon: Boxes, color: 'teal' },
  monthly: { title: 'Monthly detail', subtitle: 'A clear view of the month’s accounts', icon: CalendarDays, color: 'gold' },
}

const sections = Object.keys(sectionMeta) as Section[]
const quickSections: Section[] = ['daily', 'labor', 'hazira', 'payment', 'loading', 'debt']
const categories = ['Sales', 'Fuel', 'Materials', 'Transport', 'Food', 'Repairs', 'Labour Advance', 'Other']
const rolesList = [
  'Brick Moulder (Pathai)',
  'Kiln Worker (Bharai / Firing)',
  'Loading & Transport (Nikasi)',
  'Clay Preparation / Mixer',
  'Mason / Mistri',
  'General Labour / Helper',
  'Machine Operator',
  'Driver',
]

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const blankRecord = (type: Section): RecordEntry => ({
  id: '', type, date: today, description: '', category: type === 'payment' ? 'Wages' : type === 'hazira' || type === 'labor' ? 'Labour' : categories[0],
  received: 0, spent: 0, personName: '', wage: 0, rate: 0, attendance: 'Present', vehicle: '', size: 'Standard',
  quantity: 0, amount: 0, paid: 0, opening: 0, produced: 0, sold: 0,
  loads: [{ size: 'Standard', quantity: 0 }],
})

const defaultLaborers: Laborer[] = [
  {
    id: 'lab-ram',
    name: 'Ram',
    role: 'Brick Moulder (Pathai)',
    dailyRate: 600,
    phone: '98765 43210',
    joinDate: daysAgo(60),
    status: 'Active',
    notes: 'Master pathai worker (Table 1)',
  },
  {
    id: 'lab-shyam',
    name: 'Shyam Lal',
    role: 'Kiln Worker (Bharai / Firing)',
    dailyRate: 650,
    phone: '98123 45678',
    joinDate: daysAgo(45),
    status: 'Active',
    notes: 'Kiln firing supervisor',
  },
  {
    id: 'lab-mohan',
    name: 'Mohan Singh',
    role: 'Loading & Transport (Nikasi)',
    dailyRate: 550,
    phone: '98234 56789',
    joinDate: daysAgo(30),
    status: 'Active',
    notes: 'Truck & tractor loading crew',
  },
]

const defaultLaborEntries: LaborEntry[] = [
  // Ram
  {
    id: 'entry-ram-today',
    laborerId: 'lab-ram',
    laborerName: 'Ram',
    date: today,
    workDone: 'Moulded 1,200 bricks (Pathai)',
    attendance: 'Present',
    wage: 600,
    rate: 600,
    moneyTaken: 200,
    paymentType: 'Advance',
    notes: 'Daily kharcha advance',
  },
  {
    id: 'entry-ram-w1',
    laborerId: 'lab-ram',
    laborerName: 'Ram',
    date: daysAgo(2),
    workDone: 'Moulded 1,400 bricks',
    attendance: 'Present',
    wage: 600,
    rate: 600,
    moneyTaken: 500,
    paymentType: 'Advance',
    notes: 'Mid-week advance',
  },
  {
    id: 'entry-ram-m1',
    laborerId: 'lab-ram',
    laborerName: 'Ram',
    date: daysAgo(9),
    workDone: 'Clay mixing & mould prep',
    attendance: 'Present',
    wage: 600,
    rate: 600,
    moneyTaken: 400,
    paymentType: 'Advance',
    notes: 'Grocery cash',
  },
  {
    id: 'entry-ram-m2',
    laborerId: 'lab-ram',
    laborerName: 'Ram',
    date: daysAgo(16),
    workDone: 'Moulded 1,300 bricks',
    attendance: 'Present',
    wage: 600,
    rate: 600,
    moneyTaken: 1000,
    paymentType: 'Advance',
    notes: 'Home remittance',
  },

  // Shyam Lal
  {
    id: 'entry-shyam-today',
    laborerId: 'lab-shyam',
    laborerName: 'Shyam Lal',
    date: today,
    workDone: 'Kiln firing shift (Full day)',
    attendance: 'Present',
    wage: 650,
    rate: 650,
    moneyTaken: 300,
    paymentType: 'Advance',
    notes: 'Daily cash',
  },
  {
    id: 'entry-shyam-w1',
    laborerId: 'lab-shyam',
    laborerName: 'Shyam Lal',
    date: daysAgo(3),
    workDone: 'Kiln chamber loading (Bharai)',
    attendance: 'Present',
    wage: 650,
    rate: 650,
    moneyTaken: 500,
    paymentType: 'Advance',
    notes: 'Mid-week advance',
  },
  {
    id: 'entry-shyam-m1',
    laborerId: 'lab-shyam',
    laborerName: 'Shyam Lal',
    date: daysAgo(11),
    workDone: 'Kiln maintenance & coal supply',
    attendance: 'Present',
    wage: 650,
    rate: 650,
    moneyTaken: 800,
    paymentType: 'Advance',
    notes: 'Fuel advance',
  },

  // Mohan Singh
  {
    id: 'entry-mohan-today',
    laborerId: 'lab-mohan',
    laborerName: 'Mohan Singh',
    date: today,
    workDone: 'Loaded 2 truck consignments',
    attendance: 'Present',
    wage: 550,
    rate: 550,
    moneyTaken: 150,
    paymentType: 'Advance',
    notes: 'Chai & travel cash',
  },
  {
    id: 'entry-mohan-w1',
    laborerId: 'lab-mohan',
    laborerName: 'Mohan Singh',
    date: daysAgo(1),
    workDone: 'Tractor trolley brick unloading',
    attendance: 'Present',
    wage: 550,
    rate: 550,
    moneyTaken: 300,
    paymentType: 'Advance',
    notes: 'Kharcha',
  },
  {
    id: 'entry-mohan-m1',
    laborerId: 'lab-mohan',
    laborerName: 'Mohan Singh',
    date: daysAgo(8),
    workDone: 'Yard brick stacking & sorting',
    attendance: 'Present',
    wage: 550,
    rate: 550,
    moneyTaken: 600,
    paymentType: 'Advance',
    notes: 'Weekly settlement',
  },
]

const initialRecords = (): RecordEntry[] => {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as RecordEntry[] } catch { return [] }
}

const initialLaborers = (): Laborer[] => {
  try {
    const saved = localStorage.getItem(laborersStorageKey)
    return saved ? JSON.parse(saved) as Laborer[] : defaultLaborers
  } catch {
    return defaultLaborers
  }
}

const initialLaborEntries = (): LaborEntry[] => {
  try {
    const saved = localStorage.getItem(laborEntriesStorageKey)
    return saved ? JSON.parse(saved) as LaborEntry[] : defaultLaborEntries
  } catch {
    return defaultLaborEntries
  }
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
  const [laborers, setLaborers] = useState<Laborer[]>(initialLaborers)
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>(initialLaborEntries)

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

  // Labor Section specific states
  const [laborSearch, setLaborSearch] = useState('')
  const [laborRoleFilter, setLaborRoleFilter] = useState('All')
  const [selectedLaborerForKhata, setSelectedLaborerForKhata] = useState<Laborer | null>(null)
  const [laborerModal, setLaborerModal] = useState<{ mode: 'add' | 'edit'; laborer: Laborer } | null>(null)
  const [moneyModal, setMoneyModal] = useState<{ laborerId: string; date: string; amount: number; note: string } | null>(null)
  const [workModal, setWorkModal] = useState<{
    laborerId: string
    date: string
    workDone: string
    attendance: 'Present' | 'Half day' | 'Absent' | 'Overtime'
    wage: number
    rate: number
    note: string
  } | null>(null)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborEntry | null>(null)

  // Supabase Sync
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

  // Local storage persistence
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(records)) }, [records])
  useEffect(() => { localStorage.setItem(laborersStorageKey, JSON.stringify(laborers)) }, [laborers])
  useEffect(() => { localStorage.setItem(laborEntriesStorageKey, JSON.stringify(laborEntries)) }, [laborEntries])

  // Week range for dynamic totals (Monday to Sunday)
  const weekRange = useMemo(() => getWeekRange(today), [])

  // Compute stats for every laborer dynamically
  const laborerStats = useMemo(() => {
    return laborers.map((laborer) => {
      const logs = laborEntries.filter((e) => e.laborerId === laborer.id || e.laborerName.trim().toLowerCase() === laborer.name.trim().toLowerCase())

      // Today
      const todayLogs = logs.filter((e) => e.date === today)
      const todayTaken = todayLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
      const todayWorkEntry = todayLogs.find((e) => e.workDone) || todayLogs[0]
      const todayWork = todayWorkEntry ? todayWorkEntry.workDone || todayWorkEntry.attendance : ''
      const todayAttendance = todayWorkEntry ? todayWorkEntry.attendance : null

      // This Weekend / Week
      const weekLogs = logs.filter((e) => e.date >= weekRange.startStr && e.date <= weekRange.endStr)
      const weekTaken = weekLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)

      // This Month
      const monthLogs = logs.filter((e) => e.date.startsWith(monthFilter))
      const monthTaken = monthLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)

      // All-time totals
      const totalTaken = logs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
      const totalEarned = logs.reduce((sum, e) => sum + (e.wage || 0), 0)
      const balance = totalEarned - totalTaken

      return {
        ...laborer,
        todayTaken,
        todayWork,
        todayAttendance,
        weekTaken,
        monthTaken,
        totalTaken,
        totalEarned,
        balance,
        entriesCount: logs.length,
      }
    })
  }, [laborers, laborEntries, monthFilter, weekRange])

  // Overall Labor Metrics
  const totalActiveLaborers = laborers.filter((l) => l.status === 'Active').length
  const totalTakenTodayAll = laborerStats.reduce((sum, l) => sum + l.todayTaken, 0)
  const totalTakenWeekAll = laborerStats.reduce((sum, l) => sum + l.weekTaken, 0)
  const totalTakenMonthAll = laborerStats.reduce((sum, l) => sum + l.monthTaken, 0)
  const totalNetBalanceAll = laborerStats.reduce((sum, l) => sum + l.balance, 0)

  // Filtered Laborers for Table
  const filteredLaborers = useMemo(() => {
    return laborerStats.filter((laborer) => {
      const matchRole = laborRoleFilter === 'All' || laborer.role.toLowerCase().includes(laborRoleFilter.toLowerCase())
      const q = laborSearch.toLowerCase()
      const matchSearch = !q
        || laborer.name.toLowerCase().includes(q)
        || laborer.role.toLowerCase().includes(q)
        || (laborer.phone && laborer.phone.includes(q))
        || (laborer.todayWork && laborer.todayWork.toLowerCase().includes(q))
      return matchRole && matchSearch
    })
  }, [laborerStats, laborSearch, laborRoleFilter])

  // General Register Calculations
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

  // Save Laborer (Add or Edit)
  const handleSaveLaborer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!laborerModal) return
    const lab = laborerModal.laborer
    if (!lab.name.trim()) return

    if (laborerModal.mode === 'add') {
      const newLaborer: Laborer = {
        ...lab,
        id: lab.id || `lab-${crypto.randomUUID()}`,
      }
      setLaborers((current) => [newLaborer, ...current])
      setNotice(`Added laborer: ${newLaborer.name}`)
    } else {
      setLaborers((current) => current.map((item) => item.id === lab.id ? lab : item))
      // update laborerName in entries if name changed
      setLaborEntries((current) => current.map((e) => e.laborerId === lab.id ? { ...e, laborerName: lab.name } : e))
      setNotice(`Updated laborer: ${lab.name}`)
    }

    setLaborerModal(null)
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Delete Laborer
  const handleDeleteLaborer = (laborer: Laborer) => {
    if (!window.confirm(`Delete laborer "${laborer.name}" and all their records? This cannot be undone.`)) return
    setLaborers((current) => current.filter((l) => l.id !== laborer.id))
    setLaborEntries((current) => current.filter((e) => e.laborerId !== laborer.id && e.laborerName.toLowerCase() !== laborer.name.toLowerCase()))
    if (selectedLaborerForKhata?.id === laborer.id) setSelectedLaborerForKhata(null)
    setNotice(`Removed ${laborer.name}`)
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Save Money Taken (Advance / Cash given to laborer)
  const handleSaveMoneyTaken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moneyModal) return
    const targetWorker = laborers.find((l) => l.id === moneyModal.laborerId)
    if (!targetWorker) return

    const newEntry: LaborEntry = {
      id: `entry-${crypto.randomUUID()}`,
      laborerId: targetWorker.id,
      laborerName: targetWorker.name,
      date: moneyModal.date,
      workDone: '',
      attendance: 'Present',
      wage: 0,
      rate: targetWorker.dailyRate,
      moneyTaken: moneyModal.amount,
      paymentType: 'Advance',
      notes: moneyModal.note,
    }

    setLaborEntries((current) => [newEntry, ...current])

    // Also sync to general factory records as a payment
    if (moneyModal.amount > 0) {
      const paymentRecord: RecordEntry = {
        id: crypto.randomUUID(),
        type: 'payment',
        date: moneyModal.date,
        description: `Advance taken by ${targetWorker.name}: ${moneyModal.note || 'Cash advance'}`,
        category: 'Labour Advance',
        received: 0,
        spent: moneyModal.amount,
        personName: targetWorker.name,
        wage: 0,
        rate: targetWorker.dailyRate,
        attendance: 'Present',
        vehicle: '',
        size: 'Standard',
        quantity: 0,
        amount: moneyModal.amount,
        paid: moneyModal.amount,
        opening: 0,
        produced: 0,
        sold: 0,
        loads: [],
      }
      setRecords((current) => [paymentRecord, ...current])
      void persistRemote(paymentRecord)
    }

    setMoneyModal(null)
    setNotice(`Recorded ${money(moneyModal.amount)} taken by ${targetWorker.name}`)
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Save Work Done (Hazira & task)
  const handleSaveWorkDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workModal) return
    const targetWorker = laborers.find((l) => l.id === workModal.laborerId)
    if (!targetWorker) return

    const newEntry: LaborEntry = {
      id: `entry-${crypto.randomUUID()}`,
      laborerId: targetWorker.id,
      laborerName: targetWorker.name,
      date: workModal.date,
      workDone: workModal.workDone,
      attendance: workModal.attendance,
      wage: workModal.wage,
      rate: workModal.rate,
      moneyTaken: 0,
      notes: workModal.note,
    }

    setLaborEntries((current) => [newEntry, ...current])

    // Also sync to general factory records as hazira
    if (workModal.wage > 0 || workModal.workDone) {
      const haziraRecord: RecordEntry = {
        id: crypto.randomUUID(),
        type: 'hazira',
        date: workModal.date,
        description: workModal.workDone || `${workModal.attendance} duty`,
        category: 'Labour',
        received: 0,
        spent: 0,
        personName: targetWorker.name,
        wage: workModal.wage,
        rate: workModal.rate,
        attendance: workModal.attendance,
        vehicle: '',
        size: 'Standard',
        quantity: 0,
        amount: 0,
        paid: 0,
        opening: 0,
        produced: 0,
        sold: 0,
        loads: [],
      }
      setRecords((current) => [haziraRecord, ...current])
      void persistRemote(haziraRecord)
    }

    setWorkModal(null)
    setNotice(`Recorded work for ${targetWorker.name}`)
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Save / update existing labor entry (from Khata statement)
  const handleSaveEditedLaborEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingLaborEntry) return
    setLaborEntries((current) => current.map((e) => e.id === editingLaborEntry.id ? editingLaborEntry : e))
    setEditingLaborEntry(null)
    setNotice('Khata entry updated')
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Delete labor entry
  const handleDeleteLaborEntry = (entryId: string) => {
    if (!window.confirm('Delete this entry from the khata?')) return
    setLaborEntries((current) => current.filter((e) => e.id !== entryId))
    setNotice('Entry deleted')
    window.setTimeout(() => setNotice(''), 2800)
  }

  // Voice Input Handler
  const startVoice = (fieldSetter: (val: string) => void) => {
    type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
    type SpeechRecognizer = { lang: string; interimResults: boolean; onresult: ((event: SpeechResultEvent) => void) | null; onerror: (() => void) | null; start: () => void }
    type SpeechRecognitionCtor = new () => SpeechRecognizer
    const SpeechRecognitionApi = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
    if (!SpeechRecognitionApi) { setNotice('Voice input is not available in this browser'); return }
    const recognition = new SpeechRecognitionApi()
    recognition.lang = voiceLanguage
    recognition.interimResults = false
    recognition.onresult = (event) => fieldSetter(event.results[0][0].transcript)
    recognition.onerror = () => setNotice('Could not hear that. Please try again.')
    recognition.start()
  }

  // Export CSV for general records
  const exportCsv = () => {
    const headers = ['Date', 'Register', 'Description', 'Category', 'Person', 'Received', 'Spent', 'Amount', 'Paid', 'Balance', 'Vehicle', 'Brick size', 'Quantity']
    const rows = filteredRecords.map((record) => [
      record.date,
      sectionMeta[record.type].title,
      record.description,
      record.category,
      record.personName,
      record.received,
      record.spent,
      record.amount,
      record.paid,
      Math.max(record.amount - record.paid, 0),
      record.vehicle,
      record.type === 'loading' ? (record.loads ?? []).map((line) => `${line.size}: ${line.quantity}`).join('; ') : record.size,
      record.type === 'loading' ? (record.loads ?? []).reduce((sum, line) => sum + line.quantity, 0) : record.quantity,
    ])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hi-kitab-${section}-${today}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Export CSV for Labor Registry
  const exportLaborCsv = () => {
    const headers = [
      'Laborer Name', 'Role', 'Phone', 'Daily Rate (₹)',
      'Today Work Done', 'Today Attendance', 'Money Taken Today (₹)',
      `Weekend/Week Total (${weekRange.display}) (₹)`,
      `Month Total (${monthFilter}) (₹)`,
      'Total Wages Earned (₹)', 'Net Balance (₹)', 'Status',
    ]
    const rows = filteredLaborers.map((l) => [
      l.name,
      l.role,
      l.phone || '',
      l.dailyRate,
      l.todayWork || 'None',
      l.todayAttendance || 'None',
      l.todayTaken,
      l.weekTaken,
      l.monthTaken,
      l.totalEarned,
      l.balance,
      l.status,
    ])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hi-kitab-labor-registry-${today}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Export CSV for an individual worker's statement
  const exportWorkerKhataCsv = (worker: Laborer) => {
    const logs = laborEntries.filter((e) => e.laborerId === worker.id || e.laborerName.trim().toLowerCase() === worker.name.trim().toLowerCase()).sort((a, b) => b.date.localeCompare(a.date))
    const headers = ['Date', 'Laborer', 'Work Done', 'Attendance', 'Wage Earned (₹)', 'Money Taken / Advance (₹)', 'Notes']
    const rows = logs.map((e) => [
      e.date,
      worker.name,
      e.workDone || '',
      e.attendance,
      e.wage || 0,
      e.moneyTaken || 0,
      e.notes || '',
    ])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `khata-${worker.name.toLowerCase().replace(/\s+/g, '-')}-${today}.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const sendSms = () => {
    const text = `Hi, ${sectionMeta[section].title} update for ${displayDate.toLocaleDateString('en-IN')}. Received: ${money(receivedTotal)}. Spent: ${money(spentTotal)}. Outstanding debt: ${money(outstanding)}.`
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_self')
  }

  const readSummary = () => {
    if (!('speechSynthesis' in window)) { setNotice('Speech playback is not available in this browser'); return }
    let text = ''
    if (section === 'labor') {
      text = voiceLanguage === 'hi-IN'
        ? `कुल ${totalActiveLaborers} मजदूर दर्ज हैं। आज मजदूरों ने कुल ${totalTakenTodayAll} रुपये लिए हैं। इस हफ्ते कुल ${totalTakenWeekAll} रुपये लिए गए हैं, और इस महीने कुल ${totalTakenMonthAll} रुपये लिए गए हैं।`
        : `Total ${totalActiveLaborers} active laborers registered. Today laborers took ${totalTakenTodayAll} rupees. This week total taken is ${totalTakenWeekAll} rupees, and this month total is ${totalTakenMonthAll} rupees.`
    } else {
      text = voiceLanguage === 'hi-IN'
        ? `इस महीने कुल प्राप्त राशि ${receivedTotal} रुपये है। कुल खर्च ${spentTotal} रुपये है। बकाया उधार ${outstanding} रुपये है।`
        : `This month, money received is ${receivedTotal} rupees. Money spent is ${spentTotal} rupees. Outstanding debt is ${outstanding} rupees.`
    }
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

  const addLoadLine = () => setForm((current) => {
    if (!current) return current
    const lines = current.loads ?? [{ size: current.size, quantity: current.quantity }]
    return { ...current, loads: [...lines, { size: 'Standard', quantity: 0 }] }
  })

  const removeLoadLine = (index: number) => setForm((current) => {
    if (!current) return current
    const lines = current.loads ?? [{ size: current.size, quantity: current.quantity }]
    return { ...current, loads: lines.filter((_, i) => i !== index) }
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
          <div style={{ display: 'flex', gap: 8 }}>
            {section === 'labor' && (
              <button
                className="primary-button new-entry no-print"
                onClick={() => setLaborerModal({
                  mode: 'add',
                  laborer: {
                    id: '',
                    name: '',
                    role: rolesList[0],
                    dailyRate: 600,
                    phone: '',
                    joinDate: today,
                    status: 'Active',
                    notes: '',
                  },
                })}
              >
                <UserPlus size={16} /> Add laborer
              </button>
            )}
            <button className="secondary-button new-entry no-print" onClick={() => setForm(blankRecord(section))}>
              <Plus size={17} /> New entry
            </button>
          </div>
        </section>

        {/* Global Summary Grid */}
        <section className="summary-grid" aria-label="Monthly summary">
          <Summary icon={<ArrowDownLeft size={16} />} label="Money received" value={money(receivedTotal)} tone="green" note="this month" />
          <Summary icon={<ArrowUpRight size={16} />} label="Money spent" value={money(spentTotal)} tone="orange" note="this month" />
          <Summary icon={<Landmark size={16} />} label="Debt outstanding" value={money(outstanding)} tone="blue" note="across customers" />
          <Summary icon={<IndianRupee size={16} />} label="Month balance" value={money(monthlyProfit)} tone={monthlyProfit >= 0 ? 'green' : 'orange'} note={monthlyProfit >= 0 ? 'estimated surplus' : 'estimated shortfall'} />
        </section>

        {/* Quick Registers Workspace */}
        <section className="quick-section no-print">
          <div className="section-heading">
            <div><div className="eyebrow">YOUR WORKSPACE</div><h2>Open a register</h2></div>
            <button className="text-action" onClick={() => setSection('monthly')}>Monthly overview <ChevronDown size={15} /></button>
          </div>
          <div className="quick-grid">
            {quickSections.map((key) => {
              const item = sectionMeta[key]
              const Icon = item.icon
              return (
                <button key={key} className={`quick-card ${section === key ? 'selected' : ''}`} onClick={() => setSection(key)}>
                  <span className={`quick-icon ${item.color}`}><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="quick-title">{item.title}</span><span className="quick-arrow">↗</span>
                </button>
              )
            })}
            {sections.filter((key) => !quickSections.includes(key)).map((key) => {
              const item = sectionMeta[key]
              const Icon = item.icon
              return (
                <button key={key} className={`quick-card secondary-card ${section === key ? 'selected' : ''}`} onClick={() => setSection(key)}>
                  <span className={`quick-icon ${item.color}`}><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="quick-title">{item.title}</span><span className="quick-arrow">↗</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ===================================================================
            SECTION 1: LABOR REGISTER (Dedicated View)
            =================================================================== */}
        {section === 'labor' ? (
          <section className="labor-view">
            <div className="labor-header-bar">
              <div className="labor-title-group">
                <span className="labor-icon-badge"><Users size={22} /></span>
                <div>
                  <h2>Laborer Register & Khata</h2>
                  <p>Track each laborer's daily work, money taken today, weekend/week & month totals, and full khata</p>
                </div>
              </div>
              <div className="labor-header-actions no-print">
                <button
                  className="primary-button"
                  onClick={() => setLaborerModal({
                    mode: 'add',
                    laborer: {
                      id: '',
                      name: '',
                      role: rolesList[0],
                      dailyRate: 600,
                      phone: '',
                      joinDate: today,
                      status: 'Active',
                      notes: '',
                    },
                  })}
                >
                  <UserPlus size={16} /> Add new laborer
                </button>
                <button className="toolbar-button" title="Export CSV" onClick={exportLaborCsv}><FileDown size={16} /><span>CSV</span></button>
                <button className="toolbar-button" title="Print register" onClick={() => window.print()}><Printer size={16} /><span>Print</span></button>
                <button className="toolbar-button" title="Read summary aloud" onClick={readSummary}><Speech size={16} /><span>Read</span></button>
              </div>
            </div>

            {/* Dynamic KPI Metrics for Labor */}
            <div className="labor-kpi-grid">
              <div className="labor-kpi-card clay">
                <div className="labor-kpi-top"><span>Active Laborers</span><Users size={14} /></div>
                <div className="labor-kpi-value">{totalActiveLaborers}</div>
                <div className="labor-kpi-note">{laborers.length} registered on book</div>
              </div>
              <div className="labor-kpi-card orange">
                <div className="labor-kpi-top"><span>Money Taken Today</span><IndianRupee size={14} /></div>
                <div className="labor-kpi-value">{money(totalTakenTodayAll)}</div>
                <div className="labor-kpi-note">Cash / advances today</div>
              </div>
              <div className="labor-kpi-card gold">
                <div className="labor-kpi-top"><span>This Weekend / Week</span><CalendarDays size={14} /></div>
                <div className="labor-kpi-value">{money(totalTakenWeekAll)}</div>
                <div className="labor-kpi-note">{weekRange.display}</div>
              </div>
              <div className="labor-kpi-card blue">
                <div className="labor-kpi-top"><span>Taken This Month</span><CalendarDays size={14} /></div>
                <div className="labor-kpi-value">{money(totalTakenMonthAll)}</div>
                <div className="labor-kpi-note">{monthFilter}</div>
              </div>
              <div className="labor-kpi-card green">
                <div className="labor-kpi-top"><span>Net Wages Due</span><Wallet size={14} /></div>
                <div className="labor-kpi-value">{money(Math.max(totalNetBalanceAll, 0))}</div>
                <div className="labor-kpi-note">Total earned minus advances</div>
              </div>
            </div>

            {/* Labor Controls & Filter Row */}
            <div className="labor-control-row no-print">
              <label className="labor-search-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search laborer by name, role, phone, or work done..."
                  value={laborSearch}
                  onChange={(e) => setLaborSearch(e.target.value)}
                />
              </label>

              <div className="labor-role-tabs">
                {['All', 'Moulder', 'Kiln', 'Loading', 'Helper', 'Mason'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`labor-tab-chip ${laborRoleFilter === tab ? 'active' : ''}`}
                    onClick={() => setLaborRoleFilter(tab)}
                  >
                    {tab === 'All' ? 'All Roles' : tab}
                  </button>
                ))}
              </div>

              <div className="labor-tools-right">
                <label className="date-filter">
                  <CalendarDays size={14} />
                  <input
                    aria-label="Select month"
                    type="month"
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.target.value)}
                  />
                </label>
                <span className="result-count">{filteredLaborers.length} {filteredLaborers.length === 1 ? 'laborer' : 'laborers'}</span>
              </div>
            </div>

            {/* The Laborers Table */}
            {filteredLaborers.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Users size={23} /></span>
                <h3>No laborers found</h3>
                <p>Register your first worker or adjust search filters.</p>
                <button
                  className="secondary-button no-print"
                  onClick={() => setLaborerModal({
                    mode: 'add',
                    laborer: {
                      id: '',
                      name: '',
                      role: rolesList[0],
                      dailyRate: 600,
                      phone: '',
                      joinDate: today,
                      status: 'Active',
                      notes: '',
                    },
                  })}
                >
                  <Plus size={15} /> Add first laborer
                </button>
              </div>
            ) : (
              <div className="labor-table-wrapper">
                <table className="labor-table">
                  <thead>
                    <tr>
                      <th>Laborer & Role</th>
                      <th className="numeric">Daily Rate</th>
                      <th>What He Did Today</th>
                      <th className="numeric">Money Taken Today</th>
                      <th className="numeric">Weekend / Week Total</th>
                      <th className="numeric">Month Total</th>
                      <th className="numeric">Earned vs Balance</th>
                      <th className="no-print" style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLaborers.map((laborer) => {
                      const roleClass = laborer.role.toLowerCase().includes('mould') ? 'moulder'
                        : laborer.role.toLowerCase().includes('kiln') ? 'kiln'
                        : laborer.role.toLowerCase().includes('load') ? 'loading'
                        : laborer.role.toLowerCase().includes('mason') ? 'mason' : 'helper'

                      return (
                        <tr key={laborer.id}>
                          {/* Laborer Profile */}
                          <td>
                            <div className="laborer-cell">
                              <span className="laborer-avatar">{laborer.name.slice(0, 1).toUpperCase()}</span>
                              <div className="laborer-info">
                                <span className="laborer-name">{laborer.name}</span>
                                <div className="laborer-sub">
                                  <span className={`role-badge ${roleClass}`}>{laborer.role}</span>
                                  {laborer.phone && <span>· {laborer.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Daily Rate */}
                          <td className="numeric">
                            <strong>{money(laborer.dailyRate)}</strong>
                            <div style={{ fontSize: 10, color: '#888' }}>/ day</div>
                          </td>

                          {/* What he did today */}
                          <td>
                            {laborer.todayWork ? (
                              <div
                                className="work-badge"
                                title="Click to update work done"
                                onClick={() => setWorkModal({
                                  laborerId: laborer.id,
                                  date: today,
                                  workDone: laborer.todayWork,
                                  attendance: (laborer.todayAttendance as 'Present' | 'Half day' | 'Absent' | 'Overtime') || 'Present',
                                  wage: laborer.dailyRate,
                                  rate: laborer.dailyRate,
                                  note: '',
                                })}
                              >
                                <span className="work-badge-text">{laborer.todayWork}</span>
                                <span className={`work-badge-tag ${(laborer.todayAttendance || 'present').toLowerCase().replace(' ', '')}`}>
                                  {laborer.todayAttendance || 'Present'}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="work-badge-empty no-print"
                                onClick={() => setWorkModal({
                                  laborerId: laborer.id,
                                  date: today,
                                  workDone: '',
                                  attendance: 'Present',
                                  wage: laborer.dailyRate,
                                  rate: laborer.dailyRate,
                                  note: '',
                                })}
                              >
                                <Plus size={12} /> Add today's work
                              </button>
                            )}
                          </td>

                          {/* Money Taken Today */}
                          <td className="numeric">
                            <span className="amount-taken-today">{money(laborer.todayTaken)}</span>
                            <div style={{ marginTop: 3 }}>
                              <button
                                type="button"
                                className="btn-pill-action money-btn no-print"
                                onClick={() => setMoneyModal({
                                  laborerId: laborer.id,
                                  date: today,
                                  amount: 0,
                                  note: '',
                                })}
                              >
                                <Plus size={11} /> + Money
                              </button>
                            </div>
                          </td>

                          {/* Weekend / Week Total */}
                          <td className="numeric">
                            <span className="amount-taken-week">{money(laborer.weekTaken)}</span>
                            <div style={{ fontSize: 10, color: '#8a8e84' }}>{weekRange.display}</div>
                          </td>

                          {/* Month Total */}
                          <td className="numeric">
                            <span className="amount-taken-month">{money(laborer.monthTaken)}</span>
                            <div style={{ fontSize: 10, color: '#8a8e84' }}>{monthFilter}</div>
                          </td>

                          {/* Earned vs Balance */}
                          <td className="numeric">
                            <div style={{ fontWeight: 600, color: '#2b3329' }}>{money(laborer.totalEarned)} earned</div>
                            <div style={{ marginTop: 3 }}>
                              <span className={`balance-due-pill ${laborer.balance >= 0 ? '' : 'advance'}`}>
                                {laborer.balance >= 0 ? `${money(laborer.balance)} due` : `${money(Math.abs(laborer.balance))} advance`}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="no-print">
                            <div className="labor-actions">
                              <button
                                type="button"
                                className="btn-pill-action khata-btn"
                                title="View full khata / ledger"
                                onClick={() => setSelectedLaborerForKhata(laborer)}
                              >
                                <History size={12} /> Khata
                              </button>
                              <button
                                type="button"
                                className="icon-action-btn"
                                title="Edit laborer details"
                                onClick={() => setLaborerModal({ mode: 'edit', laborer })}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                className="icon-action-btn delete"
                                title="Delete laborer"
                                onClick={() => handleDeleteLaborer(laborer)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          /* ===================================================================
              SECTION 2: GENERAL REGISTERS VIEW (Daily, Loading, Debt, etc.)
              =================================================================== */
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
                <option value="all">All registers</option>
                {sections.map((key) => <option key={key} value={key}>{sectionMeta[key].title}</option>)}
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
                  <td className="numeric amount-in">{record.received > 0 ? money(record.received) : record.type === 'debt' && record.paid > 0 ? money(record.paid) : '—'}</td>
                  <td className="numeric amount-out">{record.type === 'hazira' && record.wage > 0 ? money(record.wage) : record.spent > 0 ? money(record.spent) : record.type === 'payment' && record.amount > 0 ? money(record.amount) : '—'}</td>
                  <td className="numeric">{record.type === 'debt' ? money(Math.max(record.amount - record.paid, 0)) : record.type === 'stock' ? `${(record.opening + record.produced - record.sold).toLocaleString('en-IN')} bricks` : record.type === 'loading' ? `${(record.loads ?? [{ size: record.size, quantity: record.quantity }]).reduce((sum, line) => sum + line.quantity, 0).toLocaleString('en-IN')} bricks` : record.quantity ? `${record.quantity.toLocaleString('en-IN')} bricks` : '—'}</td>
                  <td className="no-print"><div className="row-actions"><button title="Edit record" onClick={() => setForm({ ...record })}><Pencil size={15} /></button><button title="Delete record" onClick={() => removeRecord(record)}><Trash2 size={15} /></button></div></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
        )}

        <footer className="footer-note"><span>HI-KITAB · FACTORY REGISTER</span><span>{cloudState === 'connected' ? 'Backed up to your Supabase project' : 'Records are saved on this device'} <Cloud size={13} /></span></footer>
      </main>

      {/* ===================================================================
          MODAL 1: ADD / EDIT LABORER PROFILE
          =================================================================== */}
      {laborerModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLaborerModal(null) }}>
          <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="laborer-modal-title">
            <div className="modal-header">
              <div>
                <div className="eyebrow">LABORER REGISTRY</div>
                <h2 id="laborer-modal-title">{laborerModal.mode === 'add' ? 'Register new laborer' : `Edit: ${laborerModal.laborer.name}`}</h2>
              </div>
              <button className="icon-button" onClick={() => setLaborerModal(null)} aria-label="Close"><X size={19} /></button>
            </div>
            <form onSubmit={handleSaveLaborer}>
              <div className="form-grid">
                <Field label="Laborer full name" wide>
                  <VoiceInput
                    value={laborerModal.laborer.name}
                    onChange={(val) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, name: val } })}
                    onVoice={() => startVoice((val) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, name: val } }))}
                  />
                </Field>

                <Field label="Role / Trade">
                  <select
                    className={inputClass}
                    value={laborerModal.laborer.role}
                    onChange={(e) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, role: e.target.value } })}
                  >
                    {rolesList.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>

                <Field label="Daily wage rate (₹)">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={laborerModal.laborer.dailyRate || ''}
                    onChange={(e) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, dailyRate: Number(e.target.value) } })}
                    required
                  />
                </Field>

                <Field label="Phone / Mobile number">
                  <input
                    className={inputClass}
                    type="tel"
                    placeholder="e.g. 98765 43210"
                    value={laborerModal.laborer.phone || ''}
                    onChange={(e) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, phone: e.target.value } })}
                  />
                </Field>

                <Field label="Status">
                  <select
                    className={inputClass}
                    value={laborerModal.laborer.status}
                    onChange={(e) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, status: e.target.value as 'Active' | 'Inactive' } })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>

                <Field label="Notes / Address / ID" wide>
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="e.g. Table 1 pathai, native village, Aadhaar notes..."
                    value={laborerModal.laborer.notes || ''}
                    onChange={(e) => setLaborerModal({ ...laborerModal, laborer: { ...laborerModal.laborer, notes: e.target.value } })}
                  />
                </Field>
              </div>

              <div className="form-footer">
                <button type="button" className="secondary-button" onClick={() => setLaborerModal(null)}>Cancel</button>
                <button type="submit" className="primary-button"><Check size={16} /> Save laborer</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: LOG MONEY TAKEN (Advance / Kharcha)
          =================================================================== */}
      {moneyModal && (() => {
        const targetWorker = laborers.find((l) => l.id === moneyModal.laborerId)
        return (
          <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setMoneyModal(null) }}>
            <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="money-modal-title">
              <div className="modal-header">
                <div>
                  <div className="eyebrow">MONEY TAKEN / ADVANCE</div>
                  <h2 id="money-modal-title">{targetWorker ? targetWorker.name : 'Laborer'} took money</h2>
                </div>
                <button className="icon-button" onClick={() => setMoneyModal(null)} aria-label="Close"><X size={19} /></button>
              </div>

              <form onSubmit={handleSaveMoneyTaken}>
                <div className="form-grid">
                  <Field label="Laborer" wide>
                    <select
                      className={inputClass}
                      value={moneyModal.laborerId}
                      onChange={(e) => setMoneyModal({ ...moneyModal, laborerId: e.target.value })}
                    >
                      {laborers.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.role})</option>)}
                    </select>
                  </Field>

                  <Field label="Date">
                    <input
                      className={inputClass}
                      type="date"
                      value={moneyModal.date}
                      onChange={(e) => setMoneyModal({ ...moneyModal, date: e.target.value })}
                      required
                    />
                  </Field>

                  <Field label="Money taken today (₹)">
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      placeholder="e.g. 200"
                      value={moneyModal.amount || ''}
                      onChange={(e) => setMoneyModal({ ...moneyModal, amount: Number(e.target.value) })}
                      required
                      autoFocus
                    />
                  </Field>

                  <div className="field-wide">
                    <span style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>Quick amount buttons:</span>
                    <div className="quick-chip-group">
                      {[100, 200, 500, 1000, 2000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          className="quick-chip-btn"
                          onClick={() => setMoneyModal({ ...moneyModal, amount: (moneyModal.amount || 0) + amt })}
                        >
                          + ₹{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="quick-chip-btn"
                        onClick={() => setMoneyModal({ ...moneyModal, amount: 0 })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <Field label="Reason / Notes" wide>
                    <VoiceInput
                      value={moneyModal.note}
                      onChange={(val) => setMoneyModal({ ...moneyModal, note: val })}
                      onVoice={() => startVoice((val) => setMoneyModal({ ...moneyModal, note: val }))}
                    />
                  </Field>
                </div>

                <div className="form-footer">
                  <button type="button" className="secondary-button" onClick={() => setMoneyModal(null)}>Cancel</button>
                  <button type="submit" className="primary-button"><Check size={16} /> Record money taken</button>
                </div>
              </form>
            </section>
          </div>
        )
      })()}

      {/* ===================================================================
          MODAL 3: LOG WHAT A LABORER DID TODAY (Work & Attendance)
          =================================================================== */}
      {workModal && (() => {
        const targetWorker = laborers.find((l) => l.id === workModal.laborerId)
        return (
          <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setWorkModal(null) }}>
            <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="work-modal-title">
              <div className="modal-header">
                <div>
                  <div className="eyebrow">WORK DONE & ATTENDANCE</div>
                  <h2 id="work-modal-title">{targetWorker ? targetWorker.name : 'Laborer'}'s work</h2>
                </div>
                <button className="icon-button" onClick={() => setWorkModal(null)} aria-label="Close"><X size={19} /></button>
              </div>

              <form onSubmit={handleSaveWorkDone}>
                <div className="form-grid">
                  <Field label="Laborer" wide>
                    <select
                      className={inputClass}
                      value={workModal.laborerId}
                      onChange={(e) => {
                        const nextWorker = laborers.find((l) => l.id === e.target.value)
                        setWorkModal({
                          ...workModal,
                          laborerId: e.target.value,
                          rate: nextWorker ? nextWorker.dailyRate : workModal.rate,
                          wage: nextWorker ? nextWorker.dailyRate : workModal.wage,
                        })
                      }}
                    >
                      {laborers.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.role})</option>)}
                    </select>
                  </Field>

                  <Field label="Date">
                    <input
                      className={inputClass}
                      type="date"
                      value={workModal.date}
                      onChange={(e) => setWorkModal({ ...workModal, date: e.target.value })}
                      required
                    />
                  </Field>

                  <Field label="Attendance">
                    <select
                      className={inputClass}
                      value={workModal.attendance}
                      onChange={(e) => {
                        const att = e.target.value as 'Present' | 'Half day' | 'Absent' | 'Overtime'
                        const multiplier = att === 'Absent' ? 0 : att === 'Half day' ? 0.5 : att === 'Overtime' ? 1.5 : 1
                        setWorkModal({ ...workModal, attendance: att, wage: Math.round(workModal.rate * multiplier) })
                      }}
                    >
                      <option value="Present">Present (Full day)</option>
                      <option value="Half day">Half day (0.5x)</option>
                      <option value="Overtime">Overtime (1.5x)</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </Field>

                  <Field label="What he did today (Work / Task)" wide>
                    <VoiceInput
                      value={workModal.workDone}
                      onChange={(val) => setWorkModal({ ...workModal, workDone: val })}
                      onVoice={() => startVoice((val) => setWorkModal({ ...workModal, workDone: val }))}
                    />
                  </Field>

                  <div className="field-wide">
                    <span style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>Quick task templates:</span>
                    <div className="quick-chip-group">
                      {[
                        'Moulded 1,000 bricks',
                        'Moulded 1,200 bricks',
                        'Kiln loading (Bharai)',
                        'Kiln firing duty',
                        'Loaded 2 trucks',
                        'Clay mixing & gada',
                        'General helper duty',
                      ].map((task) => (
                        <button
                          key={task}
                          type="button"
                          className="quick-chip-btn"
                          onClick={() => setWorkModal({ ...workModal, workDone: task })}
                        >
                          {task}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="Daily rate (₹)">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={workModal.rate || ''}
                      onChange={(e) => {
                        const r = Number(e.target.value)
                        const multiplier = workModal.attendance === 'Absent' ? 0 : workModal.attendance === 'Half day' ? 0.5 : workModal.attendance === 'Overtime' ? 1.5 : 1
                        setWorkModal({ ...workModal, rate: r, wage: Math.round(r * multiplier) })
                      }}
                    />
                  </Field>

                  <Field label="Wage earned (₹)">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={workModal.wage || ''}
                      onChange={(e) => setWorkModal({ ...workModal, wage: Number(e.target.value) })}
                    />
                  </Field>

                  <Field label="Notes" wide>
                    <input
                      className={inputClass}
                      placeholder="Optional notes..."
                      value={workModal.note}
                      onChange={(e) => setWorkModal({ ...workModal, note: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="form-footer">
                  <button type="button" className="secondary-button" onClick={() => setWorkModal(null)}>Cancel</button>
                  <button type="submit" className="primary-button"><Check size={16} /> Record work done</button>
                </div>
              </form>
            </section>
          </div>
        )
      })()}

      {/* ===================================================================
          MODAL 4: LABORER KHATA / STATEMENT VIEW
          =================================================================== */}
      {selectedLaborerForKhata && (() => {
        const worker = selectedLaborerForKhata
        const logs = laborEntries
          .filter((e) => e.laborerId === worker.id || e.laborerName.trim().toLowerCase() === worker.name.trim().toLowerCase())
          .sort((a, b) => b.date.localeCompare(a.date))

        const todayLogs = logs.filter((e) => e.date === today)
        const todayTaken = todayLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
        const weekLogs = logs.filter((e) => e.date >= weekRange.startStr && e.date <= weekRange.endStr)
        const weekTaken = weekLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
        const monthLogs = logs.filter((e) => e.date.startsWith(monthFilter))
        const monthTaken = monthLogs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
        const totalTaken = logs.reduce((sum, e) => sum + (e.moneyTaken || 0), 0)
        const totalEarned = logs.reduce((sum, e) => sum + (e.wage || 0), 0)
        const balance = totalEarned - totalTaken

        return (
          <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedLaborerForKhata(null) }}>
            <section className="entry-modal khata-modal" role="dialog" aria-modal="true" aria-labelledby="khata-title">
              <div className="khata-header">
                <div className="khata-profile-row">
                  <div className="khata-name-title">
                    <span className="khata-avatar-large">{worker.name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <h2 id="khata-title">{worker.name} — Khata Registry</h2>
                      <div className="khata-meta-pills">
                        <span>{worker.role}</span>
                        <span>· Daily rate: <strong>{money(worker.dailyRate)}</strong></span>
                        {worker.phone && <span>· <Phone size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {worker.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="labor-header-actions no-print">
                    <button
                      type="button"
                      className="btn-pill-action money-btn"
                      onClick={() => setMoneyModal({ laborerId: worker.id, date: today, amount: 0, note: '' })}
                    >
                      <Plus size={12} /> Money taken
                    </button>
                    <button
                      type="button"
                      className="btn-pill-action"
                      onClick={() => setWorkModal({
                        laborerId: worker.id,
                        date: today,
                        workDone: '',
                        attendance: 'Present',
                        wage: worker.dailyRate,
                        rate: worker.dailyRate,
                        note: '',
                      })}
                    >
                      <Plus size={12} /> Work done
                    </button>
                    <button type="button" className="toolbar-button" title="Export Khata CSV" onClick={() => exportWorkerKhataCsv(worker)}>
                      <FileDown size={14} /><span>CSV</span>
                    </button>
                    <button type="button" className="icon-button" onClick={() => setSelectedLaborerForKhata(null)} aria-label="Close">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Worker Stat Strip */}
                <div className="khata-stat-strip">
                  <div className="khata-stat-box">
                    <span>Taken today</span>
                    <strong style={{ color: '#ba6337' }}>{money(todayTaken)}</strong>
                  </div>
                  <div className="khata-stat-box">
                    <span>This week / weekend</span>
                    <strong style={{ color: '#8c5737' }}>{money(weekTaken)}</strong>
                  </div>
                  <div className="khata-stat-box">
                    <span>This month</span>
                    <strong style={{ color: '#4a5445' }}>{money(monthTaken)}</strong>
                  </div>
                  <div className="khata-stat-box">
                    <span>Total earned</span>
                    <strong>{money(totalEarned)}</strong>
                  </div>
                  <div className="khata-stat-box">
                    <span>Current balance</span>
                    <strong style={{ color: balance >= 0 ? '#2b6343' : '#ba6337' }}>
                      {balance >= 0 ? `${money(balance)} due` : `${money(Math.abs(balance))} advance`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Khata Ledger Body */}
              <div className="khata-body">
                {logs.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: 140 }}>
                    <p>No transactions logged for this laborer yet.</p>
                  </div>
                ) : (
                  <table className="khata-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Work Done</th>
                        <th>Attendance</th>
                        <th className="numeric">Wage Earned</th>
                        <th className="numeric">Money Taken</th>
                        <th>Notes</th>
                        <th className="no-print" style={{ textAlign: 'center' }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ whiteSpace: 'nowrap', color: '#666' }}>
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ fontWeight: 600, color: '#2b3329' }}>{entry.workDone || '—'}</td>
                          <td>
                            <span className={`type-pill ${entry.attendance.toLowerCase()}`}>
                              {entry.attendance}
                            </span>
                          </td>
                          <td className="numeric" style={{ color: '#2b6343', fontWeight: 600 }}>
                            {entry.wage > 0 ? money(entry.wage) : '—'}
                          </td>
                          <td className="numeric" style={{ color: '#ba6337', fontWeight: 700 }}>
                            {entry.moneyTaken > 0 ? money(entry.moneyTaken) : '—'}
                          </td>
                          <td style={{ color: '#777', fontSize: 11 }}>{entry.notes || '—'}</td>
                          <td className="no-print" style={{ textAlign: 'center' }}>
                            <div className="row-actions" style={{ justifyContent: 'center' }}>
                              <button title="Edit entry" onClick={() => setEditingLaborEntry(entry)}><Pencil size={13} /></button>
                              <button title="Delete entry" onClick={() => handleDeleteLaborEntry(entry.id)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )
      })()}

      {/* ===================================================================
          MODAL 5: EDIT SINGLE KHATA ENTRY
          =================================================================== */}
      {editingLaborEntry && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingLaborEntry(null) }}>
          <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
            <div className="modal-header">
              <div>
                <div className="eyebrow">EDIT KHATA ENTRY</div>
                <h2 id="edit-entry-title">Edit entry for {editingLaborEntry.laborerName}</h2>
              </div>
              <button className="icon-button" onClick={() => setEditingLaborEntry(null)} aria-label="Close"><X size={19} /></button>
            </div>
            <form onSubmit={handleSaveEditedLaborEntry}>
              <div className="form-grid">
                <Field label="Date">
                  <input
                    className={inputClass}
                    type="date"
                    value={editingLaborEntry.date}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, date: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Attendance">
                  <select
                    className={inputClass}
                    value={editingLaborEntry.attendance}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, attendance: e.target.value as 'Present' | 'Half day' | 'Absent' | 'Overtime' })}
                  >
                    <option value="Present">Present</option>
                    <option value="Half day">Half day</option>
                    <option value="Overtime">Overtime</option>
                    <option value="Absent">Absent</option>
                  </select>
                </Field>

                <Field label="Work Done" wide>
                  <input
                    className={inputClass}
                    value={editingLaborEntry.workDone}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, workDone: e.target.value })}
                  />
                </Field>

                <Field label="Wage earned (₹)">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={editingLaborEntry.wage || ''}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, wage: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Money taken (₹)">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={editingLaborEntry.moneyTaken || ''}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, moneyTaken: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Notes" wide>
                  <input
                    className={inputClass}
                    value={editingLaborEntry.notes || ''}
                    onChange={(e) => setEditingLaborEntry({ ...editingLaborEntry, notes: e.target.value })}
                  />
                </Field>
              </div>

              <div className="form-footer">
                <button type="button" className="secondary-button" onClick={() => setEditingLaborEntry(null)}>Cancel</button>
                <button type="submit" className="primary-button"><Check size={16} /> Update entry</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ===================================================================
          MODAL 6: GENERAL RECORD ENTRY MODAL (With Labor Support)
          =================================================================== */}
      {form && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}>
        <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
          <div className="modal-header">
            <div><div className="eyebrow">FACTORY REGISTER</div><h2 id="entry-title">{form.id ? 'Edit entry' : 'New entry'}</h2></div>
            <div className="modal-tools">
              <div className="language-toggle" aria-label="Voice language">
                <button type="button" className={voiceLanguage === 'en-IN' ? 'active' : ''} onClick={() => setVoiceLanguage('en-IN')}>EN</button>
                <button type="button" className={voiceLanguage === 'hi-IN' ? 'active' : ''} onClick={() => setVoiceLanguage('hi-IN')}>हि</button>
              </div>
              <button className="icon-button" onClick={() => setForm(null)} aria-label="Close"><X size={19} /></button>
            </div>
          </div>
          <div className="section-picker">{sections.map((key) => { const Icon = sectionMeta[key].icon; return <button key={key} className={form.type === key ? 'active' : ''} onClick={() => update('type', key)}><Icon size={15} />{sectionMeta[key].title}</button> })}</div>
          <form onSubmit={saveRecord}>
            <div className="form-grid">
              <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required /></Field>
              {form.type === 'daily' && <>
                <Field label="Category"><select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
                <Field label="Money received (₹)"><input className={inputClass} type="number" min="0" value={form.received || ''} onChange={(event) => update('received', Number(event.target.value))} /></Field>
                <Field label="Money spent (₹)"><input className={inputClass} type="number" min="0" value={form.spent || ''} onChange={(event) => update('spent', Number(event.target.value))} /></Field>
              </>}
              {(form.type === 'hazira' || form.type === 'labor') && <>
                <Field label="Worker name"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice((val) => update('personName', val))} /></Field>
                <Field label="Attendance"><select className={inputClass} value={form.attendance} onChange={(event) => update('attendance', event.target.value)}><option>Present</option><option>Half day</option><option>Overtime</option><option>Absent</option></select></Field>
                <Field label="Daily rate (₹)"><input className={inputClass} type="number" min="0" value={form.rate || ''} onChange={(event) => update('rate', Number(event.target.value))} /></Field>
                <Field label="Wage due (₹)"><input className={inputClass} type="number" min="0" value={form.wage || ''} onChange={(event) => update('wage', Number(event.target.value))} /></Field>
              </>}
              {form.type === 'payment' && <>
                <Field label="Worker / payee"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice((val) => update('personName', val))} /></Field>
                <Field label="Payment type"><select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value)}><option>Wages</option><option>Advance</option><option>Labour Advance</option><option>Other</option></select></Field>
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
                  <button type="button" className="remove-load-line" aria-label={`Remove brick size ${index + 1}`} disabled={(form.loads ?? [{ size: form.size, quantity: form.quantity }]).length < 2} onClick={() => removeLoadLine(index)}><X size={15} /></button>
                </div>)}</div><button type="button" className="add-load-line" onClick={addLoadLine}><Plus size={14} /> Add brick size</button></div>
                <div className="balance-hint field-wide">Total bricks on this trip <strong>{(form.loads ?? [{ size: form.size, quantity: form.quantity }]).reduce((sum, line) => sum + line.quantity, 0).toLocaleString('en-IN')}</strong></div>
              </>}
              {form.type === 'debt' && <>
                <Field label="Customer name"><VoiceInput value={form.personName} onChange={(value) => update('personName', value)} onVoice={() => startVoice((val) => update('personName', val))} /></Field>
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
              <Field label="Notes / description" wide><VoiceInput value={form.description} onChange={(value) => update('description', value)} onVoice={() => startVoice((val) => update('description', val))} multiline /></Field>
            </div>
            {form.type === 'debt' && <div className="balance-hint">Outstanding after payment <strong>{money(Math.max(form.amount - form.paid, 0))}</strong></div>}
            {form.type === 'stock' && <div className="balance-hint">Estimated closing stock <strong>{(form.opening + form.produced - form.sold).toLocaleString('en-IN')} bricks</strong></div>}
            <div className="form-footer"><button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button><button type="submit" className="primary-button"><Check size={16} /> Save entry</button></div>
          </form>
        </section>
      </div>}

      {/* Cloud Account Sync Modal */}
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
