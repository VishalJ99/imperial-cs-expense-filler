'use client'

import { useCallback, useState } from 'react'

interface Props {
  onFilesAdded: (files: File[]) => void
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/heic',
  'application/pdf',
]

export default function DropZone({ onFilesAdded }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).filter(
        (file) =>
          ACCEPTED_TYPES.includes(file.type) ||
          file.name.toLowerCase().endsWith('.heic')
      )

      if (files.length > 0) {
        onFilesAdded(files)
      }
    },
    [onFilesAdded]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (files.length > 0) {
        onFilesAdded(files)
      }
      e.target.value = ''
    },
    [onFilesAdded]
  )

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center transition-colors
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
      `}
    >
      <div className="text-4xl mb-4">📄</div>
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drag & drop receipts here
      </p>
      <p className="text-sm text-gray-500 mb-4">
        PNG, JPEG, HEIC, or PDF files
      </p>
      <label className="inline-block px-4 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 transition-colors">
        <span className="text-sm text-gray-700">Or click to browse</span>
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.heic,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>
    </div>
  )
}
