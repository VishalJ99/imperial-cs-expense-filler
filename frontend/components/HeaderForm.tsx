'use client'

import { HeaderInfo } from '@/app/page'

interface Props {
  headerInfo: HeaderInfo
  onChange: (info: HeaderInfo) => void
}

export default function HeaderForm({ headerInfo, onChange }: Props) {
  const update = (field: keyof HeaderInfo, value: string) => {
    onChange({ ...headerInfo, [field]: value })
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm text-gray-700">Header Info</h2>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Full Name</label>
        <input
          type="text"
          value={headerInfo.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="John Smith"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">CID Number</label>
        <input
          type="text"
          value={headerInfo.cid}
          onChange={(e) => update('cid', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="12345678"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
        <input
          type="date"
          value={headerInfo.dob}
          onChange={(e) => update('dob', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Home Address</label>
        <textarea
          value={headerInfo.address}
          onChange={(e) => update('address', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          rows={2}
          placeholder="123 Main St, London"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Post Code</label>
        <input
          type="text"
          value={headerInfo.postcode}
          onChange={(e) => update('postcode', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="SW1A 1AA"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
        <input
          type="text"
          value={headerInfo.bank_name}
          onChange={(e) => update('bank_name', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="Barclays"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Sort Code</label>
        <input
          type="text"
          value={headerInfo.sort_code}
          onChange={(e) => update('sort_code', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="12-34-56"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Account Number</label>
        <input
          type="text"
          value={headerInfo.account_number}
          onChange={(e) => update('account_number', e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="12345678"
        />
      </div>

      <p className="text-xs text-gray-400 italic">
        Saved automatically to browser storage
      </p>
    </div>
  )
}
