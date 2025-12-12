'use client'

import { useState, useEffect } from 'react'
import { Receipt, ParsedReceipt, ActiveSection, TypeSpecificFields } from '@/lib/types'
import ImageModal from './ImageModal'

// Dropdown options
const TRAVEL_MODES = ['AIR TRAVEL', 'RAIL', 'TAXI', 'CAR HIRE', 'CAR PARKING', 'OTHER']
const OTHER_EXPENSE_TYPES = [
  'HOTEL / SUBSISTENCE',
  'CONFERENCE FEES',
  'BOOKS',
  'LAB SUPPLIES',
  'SOFTWARE PURCHASES',
  'TRAINING / COURSE FEES',
  'EQUIPMENT PURCHASE',
  'MEMBERSHIP SUBS.',
  'OFFICE SUNDRIES',
]

interface Props {
  receipts: Receipt[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onReparse: (index: number, userText: string, mode: 'image' | 'text') => void
  onApprove: (index: number) => void
  onUpdateParsed: (index: number, newParsed: ParsedReceipt) => void
}

// Section header component with collapse toggle
function SectionHeader({
  title,
  isActive,
  isExpanded,
  onToggle,
}: {
  title: string
  isActive: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 rounded-t border ${
        isActive
          ? 'bg-blue-50 border-blue-200 text-blue-800'
          : 'bg-gray-50 border-gray-200 text-gray-600'
      } hover:bg-opacity-80 transition-colors`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {isActive && (
          <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">
            Active
          </span>
        )}
      </div>
      <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
    </button>
  )
}

// Input field component
function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  options,
  disabled = false,
}: {
  label: string
  value: string | number | boolean | null
  onChange: (value: string | number | boolean) => void
  type?: 'text' | 'number' | 'checkbox' | 'select'
  placeholder?: string
  options?: string[]
  disabled?: boolean
}) {
  const displayValue = value === null ? '' : value

  if (type === 'checkbox') {
    return (
      <label className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
    )
  }

  if (type === 'select' && options) {
    return (
      <div className={disabled ? 'opacity-50' : ''}>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <select
          value={displayValue as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1.5 border rounded text-sm bg-white"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={displayValue as string | number}
        onChange={(e) =>
          onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)
        }
        placeholder={placeholder || 'N/A'}
        disabled={disabled}
        className={`w-full px-2 py-1.5 border rounded text-sm ${
          !value && !disabled ? 'text-gray-400 bg-gray-50' : ''
        }`}
      />
    </div>
  )
}

export default function ReceiptReview({
  receipts,
  currentIndex,
  onIndexChange,
  onReparse,
  onApprove,
  onUpdateParsed,
}: Props) {
  const [userInput, setUserInput] = useState('')
  const [parseMode, setParseMode] = useState<'image' | 'text'>('image')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<ActiveSection, boolean>>({
    travel_general: false,
    travel_mileage: false,
    hospitality: false,
    other: false,
  })

  const receipt = receipts[currentIndex]
  const parsed = receipt?.parsed

  // Update expanded sections when active section changes
  useEffect(() => {
    if (parsed) {
      setExpandedSections({
        travel_general: parsed.active_section === 'travel_general',
        travel_mileage: parsed.active_section === 'travel_mileage',
        hospitality: parsed.active_section === 'hospitality',
        other: parsed.active_section === 'other',
      })
    }
    setUserInput('')
  }, [currentIndex, parsed?.active_section])

  if (!receipt) {
    return <div className="text-center text-gray-500">No receipts to review</div>
  }

  const toggleSection = (section: ActiveSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Update a field in the parsed data
  const updateField = <S extends ActiveSection>(
    section: S,
    field: keyof TypeSpecificFields[S],
    value: TypeSpecificFields[S][typeof field]
  ) => {
    if (!parsed) return

    const newParsed: ParsedReceipt = {
      ...parsed,
      fields: {
        ...parsed.fields,
        [section]: {
          ...parsed.fields[section],
          [field]: value,
        },
      },
    }

    // If user is editing a different section's field with a real value, switch active section
    if (section !== parsed.active_section && value !== null && value !== '' && value !== false) {
      newParsed.active_section = section
    }

    onUpdateParsed(currentIndex, newParsed)
  }

  const handleReparse = () => {
    if (userInput.trim()) {
      onReparse(currentIndex, userInput, parseMode)
    }
  }

  return (
    <div className="flex-1">
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Receipt {currentIndex + 1} of {receipts.length}
        </h2>
        <div className="flex items-center gap-4">
          {parsed && (
            <span
              className={`text-sm px-2 py-1 rounded ${
                parsed.confidence === 'high'
                  ? 'bg-green-100 text-green-700'
                  : parsed.confidence === 'low'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {parsed.confidence} confidence
            </span>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Image Preview */}
        <div className="flex-shrink-0">
          {receipt.image_base64 || receipt.thumbnail_base64 ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="block cursor-zoom-in group relative"
              aria-label="Click to view full size"
            >
              <img
                src={`data:image/png;base64,${receipt.image_base64 || receipt.thumbnail_base64}`}
                alt={receipt.filename}
                className="w-72 max-h-80 object-contain rounded border group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Click to enlarge
                </span>
              </div>
            </button>
          ) : (
            <div className="w-72 h-64 bg-gray-100 rounded border flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                {receipt.processing ? 'Processing...' : 'No preview'}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1 truncate w-72">{receipt.filename}</p>

          {/* Raw description from VLM */}
          {parsed?.raw_description && (
            <div className="mt-2 p-2 bg-gray-50 rounded border text-xs text-gray-600 w-72">
              <span className="font-medium">VLM interpretation:</span>
              <p className="mt-1">{parsed.raw_description}</p>
            </div>
          )}
        </div>

        {/* Type-specific sections */}
        <div className="flex-1 space-y-2 max-h-[500px] overflow-y-auto">
          {/* Error display */}
          {receipt.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {receipt.error}
            </div>
          )}

          {/* Processing indicator */}
          {receipt.processing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing with VLM...
            </div>
          )}

          {parsed && !receipt.processing && (
            <>
              {/* TRAVEL GENERAL Section */}
              <div className="border rounded overflow-hidden">
                <SectionHeader
                  title="Travel General"
                  isActive={parsed.active_section === 'travel_general'}
                  isExpanded={expandedSections.travel_general}
                  onToggle={() => toggleSection('travel_general')}
                />
                {expandedSections.travel_general && (
                  <div className="p-3 bg-white border-t space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="Date"
                        value={parsed.fields.travel_general.date}
                        onChange={(v) => updateField('travel_general', 'date', v as string)}
                        placeholder="YYYY-MM-DD"
                      />
                      <Field
                        label="Mode"
                        type="select"
                        options={TRAVEL_MODES}
                        value={parsed.fields.travel_general.mode}
                        onChange={(v) => updateField('travel_general', 'mode', v as string)}
                      />
                      <Field
                        label="Return?"
                        type="checkbox"
                        value={parsed.fields.travel_general.is_return}
                        onChange={(v) => updateField('travel_general', 'is_return', v as boolean)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="From"
                        value={parsed.fields.travel_general.from_location}
                        onChange={(v) => updateField('travel_general', 'from_location', v as string)}
                      />
                      <Field
                        label="To"
                        value={parsed.fields.travel_general.to_location}
                        onChange={(v) => updateField('travel_general', 'to_location', v as string)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="Foreign Currency"
                        value={parsed.fields.travel_general.foreign_currency}
                        onChange={(v) => updateField('travel_general', 'foreign_currency', v as string)}
                        placeholder="e.g. 50.00 USD"
                      />
                      <Field
                        label="Sterling Total (£)"
                        type="number"
                        value={parsed.fields.travel_general.sterling_total}
                        onChange={(v) => updateField('travel_general', 'sterling_total', v as number)}
                      />
                      <Field
                        label="Non UK/EU"
                        type="checkbox"
                        value={parsed.fields.travel_general.is_non_uk_eu}
                        onChange={(v) => updateField('travel_general', 'is_non_uk_eu', v as boolean)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* TRAVEL MILEAGE Section */}
              <div className="border rounded overflow-hidden">
                <SectionHeader
                  title="Travel Car Mileage"
                  isActive={parsed.active_section === 'travel_mileage'}
                  isExpanded={expandedSections.travel_mileage}
                  onToggle={() => toggleSection('travel_mileage')}
                />
                {expandedSections.travel_mileage && (
                  <div className="p-3 bg-white border-t space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="Date"
                        value={parsed.fields.travel_mileage.date}
                        onChange={(v) => updateField('travel_mileage', 'date', v as string)}
                        placeholder="YYYY-MM-DD"
                      />
                      <Field
                        label="Number of Miles"
                        type="number"
                        value={parsed.fields.travel_mileage.miles}
                        onChange={(v) => updateField('travel_mileage', 'miles', v as number)}
                      />
                      <Field
                        label="Return?"
                        type="checkbox"
                        value={parsed.fields.travel_mileage.is_return}
                        onChange={(v) => updateField('travel_mileage', 'is_return', v as boolean)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="From"
                        value={parsed.fields.travel_mileage.from_location}
                        onChange={(v) => updateField('travel_mileage', 'from_location', v as string)}
                      />
                      <Field
                        label="To"
                        value={parsed.fields.travel_mileage.to_location}
                        onChange={(v) => updateField('travel_mileage', 'to_location', v as string)}
                      />
                      <Field
                        label="Cost per Mile (£)"
                        type="number"
                        value={parsed.fields.travel_mileage.cost_per_mile}
                        onChange={(v) => updateField('travel_mileage', 'cost_per_mile', v as number)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* HOSPITALITY Section */}
              <div className="border rounded overflow-hidden">
                <SectionHeader
                  title="Entertainment/Hospitality"
                  isActive={parsed.active_section === 'hospitality'}
                  isExpanded={expandedSections.hospitality}
                  onToggle={() => toggleSection('hospitality')}
                />
                {expandedSections.hospitality && (
                  <div className="p-3 bg-white border-t space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Date"
                        value={parsed.fields.hospitality.date}
                        onChange={(v) => updateField('hospitality', 'date', v as string)}
                        placeholder="YYYY-MM-DD"
                      />
                      <Field
                        label="Principal Guest"
                        value={parsed.fields.hospitality.principal_guest}
                        onChange={(v) => updateField('hospitality', 'principal_guest', v as string)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Organisation"
                        value={parsed.fields.hospitality.organisation}
                        onChange={(v) => updateField('hospitality', 'organisation', v as string)}
                      />
                      <Field
                        label="Total Numbers Present"
                        type="number"
                        value={parsed.fields.hospitality.total_numbers}
                        onChange={(v) => updateField('hospitality', 'total_numbers', v as number)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="Foreign Currency"
                        value={parsed.fields.hospitality.foreign_currency}
                        onChange={(v) => updateField('hospitality', 'foreign_currency', v as string)}
                        placeholder="e.g. 100.00 EUR"
                      />
                      <Field
                        label="Sterling Total (£)"
                        type="number"
                        value={parsed.fields.hospitality.sterling_total}
                        onChange={(v) => updateField('hospitality', 'sterling_total', v as number)}
                      />
                      <Field
                        label="Non-college Staff"
                        type="checkbox"
                        value={parsed.fields.hospitality.non_college_staff}
                        onChange={(v) => updateField('hospitality', 'non_college_staff', v as boolean)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* OTHER Section */}
              <div className="border rounded overflow-hidden">
                <SectionHeader
                  title="Subsistence/Hotels/Other"
                  isActive={parsed.active_section === 'other'}
                  isExpanded={expandedSections.other}
                  onToggle={() => toggleSection('other')}
                />
                {expandedSections.other && (
                  <div className="p-3 bg-white border-t space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Date"
                        value={parsed.fields.other.date}
                        onChange={(v) => updateField('other', 'date', v as string)}
                        placeholder="YYYY-MM-DD"
                      />
                      <Field
                        label="Expense Type"
                        type="select"
                        options={OTHER_EXPENSE_TYPES}
                        value={parsed.fields.other.expense_type}
                        onChange={(v) => updateField('other', 'expense_type', v as string)}
                      />
                    </div>
                    <Field
                      label="Description"
                      value={parsed.fields.other.description}
                      onChange={(v) => updateField('other', 'description', v as string)}
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Field
                        label="Foreign Currency"
                        value={parsed.fields.other.foreign_currency}
                        onChange={(v) => updateField('other', 'foreign_currency', v as string)}
                        placeholder="e.g. 50.00 USD"
                      />
                      <Field
                        label="Sterling Total (£)"
                        type="number"
                        value={parsed.fields.other.sterling_total}
                        onChange={(v) => updateField('other', 'sterling_total', v as number)}
                      />
                      <Field
                        label="Non UK/EU"
                        type="checkbox"
                        value={parsed.fields.other.is_non_uk_eu}
                        onChange={(v) => updateField('other', 'is_non_uk_eu', v as boolean)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* VLM Chat for complex operations */}
              <div className="mt-4 p-3 bg-gray-50 rounded border">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  VLM Chat (for complex operations):
                </label>
                <div className="flex gap-2">
                  <input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder='e.g. "divide total by 6 for shared bill"'
                    className="flex-1 px-3 py-2 border rounded text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleReparse()}
                  />
                  <button
                    onClick={handleReparse}
                    disabled={!userInput.trim() || receipt.processing}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <button
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          ← Previous
        </button>

        <button
          onClick={() => onApprove(currentIndex)}
          disabled={!receipt.parsed || receipt.processing}
          className={`px-6 py-2 rounded font-medium ${
            receipt.approved
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-green-600 text-white hover:bg-green-700'
          } disabled:bg-gray-400 disabled:text-white`}
        >
          {receipt.approved ? '✓ Approved' : 'Approve & Next'}
        </button>

        <button
          onClick={() => onIndexChange(Math.min(receipts.length - 1, currentIndex + 1))}
          disabled={currentIndex === receipts.length - 1}
          className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Next →
        </button>
      </div>

      {/* Receipt thumbnails strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto py-2">
        {receipts.map((r, idx) => (
          <button
            key={r.id}
            onClick={() => onIndexChange(idx)}
            className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
              idx === currentIndex
                ? 'border-blue-500'
                : r.approved
                ? 'border-green-500'
                : 'border-gray-200'
            }`}
          >
            {r.thumbnail_base64 ? (
              <img
                src={`data:image/png;base64,${r.thumbnail_base64}`}
                alt={r.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                {idx + 1}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Full-screen image modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={`data:image/png;base64,${receipt.image_base64 || receipt.thumbnail_base64}`}
        alt={receipt.filename}
      />
    </div>
  )
}
