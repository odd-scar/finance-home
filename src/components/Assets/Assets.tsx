import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { addAsset, updateAsset, removeAsset } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { Plus, Trash2, Edit2, Car, Building, Laptop, Star, Package, Info } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Asset } from '../../types'

const CATEGORIES = ['vehicle', 'real_estate', 'electronics', 'collectibles', 'other'] as const

const catLabels: Record<Asset['category'], string> = {
  vehicle: 'Vehicle',
  real_estate: 'Real Estate',
  electronics: 'Electronics',
  collectibles: 'Collectibles',
  other: 'Other',
}

const catColors: Record<Asset['category'], string> = {
  vehicle: 'bg-blue-500/20 text-blue-400',
  real_estate: 'bg-emerald-500/20 text-emerald-400',
  electronics: 'bg-purple-500/20 text-purple-400',
  collectibles: 'bg-amber-500/20 text-amber-400',
  other: 'bg-gray-500/20 text-gray-400',
}

function CatIcon({ category, size = 18 }: { category: Asset['category']; size?: number }) {
  const props = { size, className: 'shrink-0' }
  switch (category) {
    case 'vehicle': return <Car {...props} />
    case 'real_estate': return <Building {...props} />
    case 'electronics': return <Laptop {...props} />
    case 'collectibles': return <Star {...props} />
    default: return <Package {...props} />
  }
}

const emptyForm = {
  name: '',
  value: '',
  category: 'vehicle' as Asset['category'],
  notes: '',
}

export function Assets() {
  const { assets } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const totalValue = assets.reduce((s, a) => s + a.value, 0)

  const countByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = assets.filter(a => a.category === cat).length
    return acc
  }, {} as Record<Asset['category'], number>)

  const handleAdd = () => {
    if (!form.name || !form.value) return
    const asset: Asset = {
      id: uuid(),
      name: form.name,
      value: parseFloat(form.value) || 0,
      category: form.category,
      notes: form.notes || undefined,
      addedAt: new Date().toISOString(),
    }
    addAsset(asset)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editAsset) return
    updateAsset(editAsset.id, {
      name: form.name,
      value: parseFloat(form.value) || 0,
      category: form.category,
      notes: form.notes || undefined,
    })
    setEditAsset(null)
  }

  const openEdit = (a: Asset) => {
    setEditAsset(a)
    setForm({
      name: a.name,
      value: String(a.value),
      category: a.category,
      notes: a.notes || '',
    })
  }

  const assetFormJsx = (
    <div className="space-y-4">
      <FormField label="Asset Name">
        <Input
          placeholder="Honda Civic, MacBook Pro, Guitar…"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Current Value ($)">
          <Input
            type="number"
            placeholder="0.00"
            value={form.value}
            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
          />
        </FormField>
        <FormField label="Category">
          <Select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as Asset['category'] }))}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{catLabels[c]}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes (optional)" hint="E.g. KBB estimate, last appraised value, purchase receipt, etc.">
        <Input
          placeholder="Any notes about this asset…"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </FormField>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Net Worth callout */}
      <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <Info size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-300">
          These values are included in your Net Worth calculation on the Dashboard. Update your asset values periodically (e.g. use KBB for vehicle estimates).
        </p>
      </div>

      {/* Total + category breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
        <p className="text-sm text-gray-400 mb-1">Total Assets Value</p>
        <p className="text-4xl font-bold text-white mb-4">${totalValue.toLocaleString()}</p>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.filter(cat => countByCategory[cat] > 0).map(cat => (
            <div key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${catColors[cat]}`}>
              <CatIcon category={cat} size={12} />
              {catLabels[cat]} ({countByCategory[cat]})
            </div>
          ))}
          {assets.length === 0 && (
            <p className="text-sm text-gray-500">No assets added yet.</p>
          )}
        </div>
      </div>

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Asset List</h2>
        <Button onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}>
          <Plus size={14} /> Add Asset
        </Button>
      </div>

      {/* Asset cards grid */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
          <Package size={36} className="opacity-30" />
          <p className="text-sm">No assets yet. Add your first physical asset!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {assets.map(asset => (
            <div key={asset.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${catColors[asset.category]}`}>
                    <CatIcon category={asset.category} size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{asset.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColors[asset.category]}`}>
                      {catLabels[asset.category]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(asset)}
                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAsset(asset.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-600 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Current Value</span>
                  <span className="text-xl font-bold text-white">${asset.value.toLocaleString()}</span>
                </div>
                {asset.notes && (
                  <p className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2 break-words">{asset.notes}</p>
                )}
                <p className="text-xs text-gray-600">
                  Added {new Date(asset.addedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Asset"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Asset</Button></div>}
      >{assetFormJsx}</Modal>
      <Modal
        open={!!editAsset}
        onClose={() => { setEditAsset(null); setForm({ ...emptyForm }) }}
        title="Edit Asset"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditAsset(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save Changes</Button></div>}
      >{assetFormJsx}</Modal>
    </div>
  )
}
