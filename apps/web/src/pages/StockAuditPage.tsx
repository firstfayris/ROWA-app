import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { Printer, Plus, CheckCircle, ClipboardList, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

interface AuditItem {
  id?: string
  product_id: string
  variant_id?: string | null
  variant_label?: string | null
  product_name: string
  product_sku: string
  product_brand: string
  product_category: string
  system_qty: number
  actual_qty: string
  note: string
}

interface Audit {
  id: string
  status: string
  note: string | null
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
  created_by_name?: string
  items?: AuditItem[]
}

function ExportMenu({ onPrint, onPDF, onExcel, onClose }: {
  onPrint: (f: 'all' | 'in-stock') => void
  onPDF: (f: 'all' | 'in-stock') => void
  onExcel: (f: 'all' | 'in-stock') => void
  onClose: () => void
}) {
  const sections = [
    { icon: <Printer className="h-4 w-4 text-gray-500" />, label: 'ปริ้น', action: onPrint },
    { icon: <FileText className="h-4 w-4 text-red-500" />, label: 'ดาวน์โหลด PDF', action: onPDF },
    { icon: <FileSpreadsheet className="h-4 w-4 text-green-600" />, label: 'ดาวน์โหลด Excel', action: onExcel },
  ]
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-64">
        {sections.map((s, si) => (
          <div key={si}>
            {si > 0 && <div className="border-t border-gray-100" />}
            <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              {s.icon} {s.label}
            </p>
            <button onClick={() => s.action('all')} className="w-full text-left px-4 py-2 text-sm hover:bg-rowa-bg transition-colors flex items-center justify-between">
              <span className="text-rowa-text">สินค้าทั้งหมด</span>
              <span className="text-xs text-rowa-muted">รวมสต็อก = 0</span>
            </button>
            <button onClick={() => s.action('in-stock')} className="w-full text-left px-4 pb-2.5 pt-1 text-sm hover:bg-rowa-bg transition-colors flex items-center justify-between">
              <span className="text-rowa-text">เฉพาะที่มีของอยู่</span>
              <span className="text-xs text-green-600">สต็อก &gt; 0</span>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

const statusLabel: Record<string, string> = {
  draft: 'ร่าง',
  submitted: 'รอตรวจสอบ',
  reviewed: 'ตรวจแล้ว',
}
const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
  draft: 'default',
  submitted: 'warning',
  reviewed: 'success',
}

export function StockAuditPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [view, setView] = useState<'list' | 'new' | 'detail'>('list')
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New audit
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [auditNote, setAuditNote] = useState('')

  // Detail view
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Print
  const [printFilter, setPrintFilter] = useState<'all' | 'in-stock'>('all')
  const [showPrintMenu, setShowPrintMenu] = useState(false)

  const fetchAudits = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stock_audits')
      .select('*')
      .order('created_at', { ascending: false })
    setAudits(data ?? [])
    setLoading(false)
  }

  const loadProducts = async () => {
    const [{ data: prods }, { data: cats }, { data: variantStocks }] = await Promise.all([
      supabase.from('product_stock').select('id, name, sku, current_stock, category_id').order('name'),
      supabase.from('categories').select('id, name, brand'),
      supabase.from('variant_stock').select('id, product_id, color, size, current_stock'),
    ])

    const variantMap: Record<string, typeof variantStocks> = {}
    for (const v of variantStocks ?? []) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id]!.push(v)
    }

    const items: AuditItem[] = []
    for (const p of prods ?? []) {
      const cat = cats?.find(c => c.id === p.category_id)
      const base = {
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        product_brand: cat?.brand ?? '—',
        product_category: cat?.name ?? '—',
        actual_qty: '',
        note: '',
      }
      const variants = variantMap[p.id]
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const label = [v.color, v.size].filter(Boolean).join(' / ') || 'ตัวเลือก'
          items.push({ ...base, variant_id: v.id, variant_label: label, system_qty: v.current_stock ?? 0 })
        }
      } else {
        items.push({ ...base, variant_id: null, variant_label: null, system_qty: p.current_stock ?? 0 })
      }
    }
    setAuditItems(items)
  }

  useEffect(() => { fetchAudits() }, [])

  const startNewAudit = async () => {
    await loadProducts()
    setAuditNote('')
    setView('new')
  }

  const saveAudit = async (submitNow: boolean) => {
    setSaving(true)
    const { data: audit, error } = await supabase
      .from('stock_audits')
      .insert({
        status: submitNow ? 'submitted' : 'draft',
        note: auditNote || null,
        created_by: profile?.id,
        submitted_at: submitNow ? new Date().toISOString() : null,
      })
      .select().single()

    if (error) { toast.error(error.message); setSaving(false); return }

    const itemsToSave = auditItems.map(i => ({
      audit_id: audit.id,
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      system_qty: i.system_qty,
      actual_qty: i.actual_qty !== '' ? parseInt(i.actual_qty) : null,
      note: i.note || null,
    }))

    const { error: itemsErr } = await supabase.from('stock_audit_items').insert(itemsToSave)
    if (itemsErr) { toast.error(itemsErr.message); setSaving(false); return }

    toast.success(submitNow ? 'ส่งผลนับแล้ว' : 'บันทึกร่างแล้ว')
    fetchAudits()
    setView('list')
    setSaving(false)
  }

  const loadAuditDetail = async (audit: Audit) => {
    const { data: items } = await supabase
      .from('stock_audit_items')
      .select('*, product:products(name, sku)')
      .eq('audit_id', audit.id)

    const { data: cats } = await supabase.from('categories').select('id, name, brand')
    const { data: prods } = await supabase.from('product_stock').select('id, category_id')

    const mapped: AuditItem[] = (items ?? []).map((i: any) => {
      const prod = prods?.find(p => p.id === i.product_id)
      const cat = cats?.find(c => c.id === prod?.category_id)
      return {
        id: i.id,
        product_id: i.product_id,
        product_name: i.product?.name ?? '—',
        product_sku: i.product?.sku ?? '—',
        product_brand: cat?.brand ?? '—',
        product_category: cat?.name ?? '—',
        system_qty: i.system_qty,
        actual_qty: i.actual_qty?.toString() ?? '—',
        note: i.note ?? '',
      }
    })
    setSelectedAudit({ ...audit, items: mapped })
    setView('detail')
  }

  const markReviewed = async (id: string) => {
    await supabase.from('stock_audits').update({ status: 'reviewed', reviewed_at: new Date().toISOString() }).eq('id', id)
    toast.success('ทำเครื่องหมายตรวจแล้ว')
    fetchAudits()
    setView('list')
  }

  const printAudit = (filter: 'all' | 'in-stock') => {
    setPrintFilter(filter)
    setShowPrintMenu(false)
    setTimeout(() => window.print(), 50)
  }

  const getExportItems = (filter: 'all' | 'in-stock'): AuditItem[] => {
    const base = view === 'new' ? auditItems : selectedAudit?.items ?? []
    return filter === 'in-stock' ? base.filter(i => i.system_qty > 0) : base
  }

  const dateLabel = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
  const noteLabel = auditNote || selectedAudit?.note || ''

  const downloadPDF = async (filter: 'all' | 'in-stock') => {
    setShowPrintMenu(false)
    const items = getExportItems(filter)
    const isDetail = view === 'detail'
    const filterSuffix = filter === 'in-stock' ? '_in-stock' : '_all'

    // Build a hidden HTML element with Thai text rendered by the browser
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1123px;background:#fff;font-family:sans-serif;font-size:12px;padding:24px'
    container.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:20px;font-weight:bold;color:#4B5DB8">ROWA — ใบตรวจนับสต็อก</div>
        <div style="font-size:11px;color:#888;margin-top:4px">
          วันที่พิมพ์: ${dateLabel}${noteLabel ? ' · ' + noteLabel : ''} · ${filter === 'in-stock' ? 'เฉพาะสินค้าที่มีของอยู่' : 'สินค้าทั้งหมด'}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:#4B5DB8;color:#fff">
            <th style="padding:6px 8px;border:1px solid #3a4a9a;width:30px">#</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;text-align:left">ชื่อสินค้า</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;text-align:left">แบรนด์</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;text-align:left">หมวดหมู่</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;text-align:left">SKU</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;width:70px">สต็อกระบบ</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;width:70px">นับได้</th>
            <th style="padding:6px 8px;border:1px solid #3a4a9a;width:120px;text-align:left">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, i) => {
            const prev = items[i - 1]
            const isFirst = !prev || prev.product_id !== item.product_id
            const nameCell = isFirst
              ? `${item.product_name}${item.variant_label ? ` <span style="background:#f3f4f6;border-radius:4px;padding:1px 5px;font-size:10px">${item.variant_label}</span>` : ''}`
              : item.variant_label ? `<span style="background:#f3f4f6;border-radius:4px;padding:1px 5px;font-size:10px">${item.variant_label}</span>` : ''
            return `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9ff'}">
              <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
              <td style="padding:5px 8px;border:1px solid #ddd">${nameCell}</td>
              <td style="padding:5px 8px;border:1px solid #ddd">${isFirst ? item.product_brand : ''}</td>
              <td style="padding:5px 8px;border:1px solid #ddd">${isFirst ? item.product_category : ''}</td>
              <td style="padding:5px 8px;border:1px solid #ddd;font-family:monospace;font-size:10px">${isFirst ? item.product_sku : ''}</td>
              <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${item.system_qty}</td>
              <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${isDetail && item.actual_qty !== '—' ? item.actual_qty : ''}</td>
              <td style="padding:5px 8px;border:1px solid #ddd">${isDetail ? item.note : ''}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:20px;font-size:11px;color:#888">
        ลายเซ็นผู้นับ: ___________________________&nbsp;&nbsp;&nbsp; วันที่: _______________
      </div>
    `
    document.body.appendChild(container)

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 10
      const imgH = (canvas.height * imgW) / canvas.width

      // paginate if content taller than one page
      let y = 5
      let remaining = imgH
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - 10)
        const srcY = (imgH - remaining) * (canvas.height / imgH)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceH * (canvas.height / imgH)
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 5, y, imgW, sliceH)
        remaining -= sliceH
        if (remaining > 0) { pdf.addPage(); y = 5 }
      }

      pdf.save(`ROWA_StockCount_${new Date().toISOString().slice(0, 10)}${filterSuffix}.pdf`)
      toast.success('ดาวน์โหลด PDF แล้ว')
    } finally {
      document.body.removeChild(container)
    }
  }

  const downloadExcel = (filter: 'all' | 'in-stock') => {
    setShowPrintMenu(false)
    const items = getExportItems(filter)
    const isDetail = view === 'detail'

    const headers = ['#', 'ชื่อสินค้า', 'แบรนด์', 'หมวดหมู่', 'SKU', 'สต็อกในระบบ', 'จำนวนที่นับได้', 'หมายเหตุ']
    const rows = items.map((item, i) => [
      i + 1,
      item.product_name,
      item.product_brand,
      item.product_category,
      item.product_sku,
      item.system_qty,
      isDetail && item.actual_qty !== '—' ? parseInt(item.actual_qty) : '',
      isDetail ? item.note : '',
    ])

    const ws = XLSX.utils.aoa_to_sheet([
      [`ROWA — ใบตรวจนับสต็อก`],
      [`วันที่: ${dateLabel}${noteLabel ? '  |  ' + noteLabel : ''}  |  ${filter === 'in-stock' ? 'เฉพาะสินค้าที่มีของอยู่' : 'สินค้าทั้งหมด'}`],
      [],
      headers,
      ...rows,
      [],
      ['ลายเซ็นผู้นับ: ___________________________', '', '', 'วันที่: _______________'],
    ])

    // Column widths
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Count')
    const filterSuffix = filter === 'in-stock' ? '_in-stock' : '_all'
    XLSX.writeFile(wb, `ROWA_StockCount_${new Date().toISOString().slice(0, 10)}${filterSuffix}.xlsx`)
    toast.success('ดาวน์โหลด Excel แล้ว')
  }

  const diffItems = selectedAudit?.items?.filter(i => i.actual_qty !== '—' && parseInt(i.actual_qty) !== i.system_qty) ?? []

  // ---- PRINT STYLES ----
  return (
    <>
      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          #print-root { display: block !important; }
          .no-print { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .print-table th, .print-table td { border: 1px solid #ccc; padding: 6px 8px; }
          .print-table th { background: #f3f4f6; font-weight: 600; }
        }
      `}</style>

      <div className="space-y-6 no-print">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-rowa-text">ตรวจนับสต็อก</h1>
            <p className="text-rowa-muted text-sm">ออกใบนับสต็อก ส่งผล และเปรียบเทียบกับระบบ</p>
          </div>
          <div className="flex gap-2">
            {view !== 'list' && <Button variant="secondary" onClick={() => setView('list')}>← กลับ</Button>}
            {view === 'list' && (
              <Button onClick={startNewAudit}>
                <Plus className="h-4 w-4" /> สร้างใบนับสต็อก
              </Button>
            )}
          </div>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-rowa-muted">กำลังโหลด...</div>
            ) : audits.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2 text-rowa-muted">
                <ClipboardList className="h-10 w-10 opacity-30" />
                <p>ยังไม่มีใบนับสต็อก</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-rowa-bg/50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">วันที่สร้าง</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">สถานะ</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมายเหตุ</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ส่งเมื่อ</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {audits.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-3 text-sm text-rowa-muted whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-rowa-muted">{a.note ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-rowa-muted">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <Button size="sm" variant="secondary" onClick={() => loadAuditDetail(a)}>ดูรายละเอียด</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* NEW AUDIT VIEW */}
        {view === 'new' && (
          <div className="space-y-4">
            <div className="card flex flex-wrap gap-4 items-end justify-between">
              <Input label="หมายเหตุ (ไม่บังคับ)" value={auditNote} onChange={e => setAuditNote(e.target.value)} placeholder="เช่น นับสต็อกประจำเดือน มิ.ย." className="w-72" />
              <div className="flex gap-2">
                <div className="relative">
                  <Button variant="secondary" onClick={() => setShowPrintMenu(m => !m)}>
                    <Printer className="h-4 w-4" /> ปริ้น / ดาวน์โหลด <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                  {showPrintMenu && <ExportMenu onPrint={printAudit} onPDF={downloadPDF} onExcel={downloadExcel} onClose={() => setShowPrintMenu(false)} />}
                </div>
                <Button variant="secondary" loading={saving} onClick={() => saveAudit(false)}>บันทึกร่าง</Button>
                <Button loading={saving} onClick={() => saveAudit(true)}><CheckCircle className="h-4 w-4" /> ส่งผลนับ</Button>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-rowa-bg/50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3 w-8">#</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">สินค้า</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">แบรนด์ / หมวดหมู่</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">SKU</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">สต็อกในระบบ</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">จำนวนที่นับได้</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map((item, i) => {
                    const prevItem = auditItems[i - 1]
                    const isFirstOfProduct = !prevItem || prevItem.product_id !== item.product_id
                    return (
                      <tr key={`${item.product_id}-${item.variant_id ?? 'nv'}`} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2">
                          {isFirstOfProduct && <p className="text-sm font-medium">{item.product_name}</p>}
                          {item.variant_label && (
                            <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 mt-0.5">{item.variant_label}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-rowa-muted">{isFirstOfProduct ? `${item.product_brand} · ${item.product_category}` : ''}</td>
                        <td className="px-4 py-2 text-xs font-mono text-rowa-muted">{isFirstOfProduct ? item.product_sku : ''}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant={item.system_qty === 0 ? 'danger' : item.system_qty <= 5 ? 'warning' : 'success'}>
                            {item.system_qty}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" placeholder="—"
                            value={item.actual_qty}
                            onChange={e => setAuditItems(items => items.map((it, j) => j === i ? { ...it, actual_qty: e.target.value } : it))}
                            className="input text-center w-20 mx-auto block" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="text" placeholder="หมายเหตุ"
                            value={item.note}
                            onChange={e => setAuditItems(items => items.map((it, j) => j === i ? { ...it, note: e.target.value } : it))}
                            className="input text-sm w-36" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && selectedAudit && (
          <div className="space-y-4">
            <div className="card flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant[selectedAudit.status]}>{statusLabel[selectedAudit.status]}</Badge>
                <span className="text-sm text-rowa-muted">
                  สร้าง {new Date(selectedAudit.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {selectedAudit.note && <span className="text-sm text-rowa-muted">· {selectedAudit.note}</span>}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Button variant="secondary" onClick={() => setShowPrintMenu(m => !m)}>
                    <Printer className="h-4 w-4" /> ปริ้น / ดาวน์โหลด <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                  {showPrintMenu && <ExportMenu onPrint={printAudit} onPDF={downloadPDF} onExcel={downloadExcel} onClose={() => setShowPrintMenu(false)} />}
                </div>
                {isAdmin && selectedAudit.status === 'submitted' && (
                  <Button onClick={() => markReviewed(selectedAudit.id)}>
                    <CheckCircle className="h-4 w-4" /> ยืนยันตรวจแล้ว
                  </Button>
                )}
              </div>
            </div>

            {/* Diff summary */}
            {diffItems.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ พบความต่าง {diffItems.length} รายการ</p>
                <div className="flex flex-wrap gap-2">
                  {diffItems.map(item => {
                    const diff = parseInt(item.actual_qty) - item.system_qty
                    return (
                      <div key={item.product_id} className="bg-white border border-yellow-200 rounded-lg px-3 py-1.5 text-sm">
                        <span className="font-medium">{item.product_name}</span>
                        <span className="text-rowa-muted ml-2">ระบบ: {item.system_qty}</span>
                        <span className="text-rowa-muted"> → นับได้: {item.actual_qty}</span>
                        <span className={`ml-2 font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({diff > 0 ? '+' : ''}{diff})
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {diffItems.length === 0 && selectedAudit.status !== 'draft' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                ✅ สต็อกตรงกันทุกรายการ
              </div>
            )}

            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-rowa-bg/50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3 w-8">#</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">สินค้า</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">แบรนด์ / หมวดหมู่</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">สต็อกระบบ</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">นับได้</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">ผลต่าง</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedAudit.items ?? []).map((item, i) => {
                    const actual = item.actual_qty !== '—' ? parseInt(item.actual_qty) : null
                    const diff = actual !== null ? actual - item.system_qty : null
                    const hasDiff = diff !== null && diff !== 0
                    return (
                      <tr key={item.product_id} className={`border-b border-gray-50 ${hasDiff ? 'bg-yellow-50/50' : ''}`}>
                        <td className="px-4 py-2 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 text-sm font-medium">{item.product_name}<br /><span className="text-xs font-mono text-gray-400">{item.product_sku}</span></td>
                        <td className="px-4 py-2 text-xs text-rowa-muted">{item.product_brand} · {item.product_category}</td>
                        <td className="px-4 py-2 text-center text-sm">{item.system_qty}</td>
                        <td className="px-4 py-2 text-center text-sm font-medium">{item.actual_qty !== '—' ? item.actual_qty : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2 text-center text-sm font-bold">
                          {diff !== null ? (
                            <span className={diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}>
                              {diff === 0 ? '✓' : diff > 0 ? `+${diff}` : diff}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-rowa-muted">{item.note || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PRINT TEMPLATE */}
      <div id="print-root" style={{ display: 'none' }} className="p-6">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 'bold' }}>ROWA — ใบตรวจนับสต็อก</h1>
          <p style={{ fontSize: 12, color: '#666' }}>
            วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            {auditNote || selectedAudit?.note ? ` · ${auditNote || selectedAudit?.note}` : ''}
            {' · '}{printFilter === 'in-stock' ? 'เฉพาะสินค้าที่มีของอยู่' : 'สินค้าทั้งหมด'}
          </p>
        </div>
        {printFilter === 'in-stock' && (
          <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            * แสดงเฉพาะสินค้าที่มีสต็อกอยู่ในระบบ (ไม่รวมรายการที่สต็อก = 0)
          </p>
        )}
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>ชื่อสินค้า</th>
              <th>แบรนด์</th>
              <th>หมวดหมู่</th>
              <th>SKU</th>
              <th style={{ width: 80 }}>ระบบ</th>
              <th style={{ width: 80 }}>นับได้</th>
              <th style={{ width: 120 }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const baseItems = (view === 'new' ? auditItems : selectedAudit?.items ?? [])
                .filter(item => printFilter === 'all' || item.system_qty > 0)
              return baseItems.map((item, i) => {
                const prevItem = baseItems[i - 1]
                const isFirst = !prevItem || prevItem.product_id !== item.product_id
                return (
                  <tr key={`${item.product_id}-${item.variant_id ?? i}`}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>
                      {isFirst && <span>{item.product_name}</span>}
                      {item.variant_label && (
                        <span style={{ display: 'inline-block', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: 10, marginLeft: isFirst ? 6 : 0 }}>
                          {item.variant_label}
                        </span>
                      )}
                    </td>
                    <td>{isFirst ? item.product_brand : ''}</td>
                    <td>{isFirst ? item.product_category : ''}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{isFirst ? item.product_sku : ''}</td>
                    <td style={{ textAlign: 'center' }}>{item.system_qty}</td>
                    <td style={{ textAlign: 'center' }}>{view === 'detail' && item.actual_qty !== '—' ? item.actual_qty : ''}</td>
                    <td>{view === 'detail' ? item.note : ''}</td>
                  </tr>
                )
              })
            })()}
          </tbody>
        </table>
        <p style={{ marginTop: 24, fontSize: 11, color: '#999' }}>
          ลายเซ็นผู้นับ: _________________________  วันที่: _______________
        </p>
      </div>
    </>
  )
}
