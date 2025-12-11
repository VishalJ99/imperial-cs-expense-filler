'use client'

interface Props {
  models: { id: string; name: string }[]
  selected: string
  onChange: (id: string) => void
}

export default function ModelSelector({ models, selected, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        VLM Model
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-400 mt-1">
        Used for receipt OCR & parsing
      </p>
    </div>
  )
}
