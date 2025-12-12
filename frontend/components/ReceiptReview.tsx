'use client'

import { useState } from 'react'
import { Receipt } from '@/app/page'
import ImageModal from './ImageModal'

interface Props {
  receipts: Receipt[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onReparse: (index: number, userText: string, mode: 'image' | 'text') => void
  onApprove: (index: number) => void
}

export default function ReceiptReview({
  receipts,
  currentIndex,
  onIndexChange,
  onReparse,
  onApprove,
}: Props) {
  const [userInput, setUserInput] = useState('')
  const [parseMode, setParseMode] = useState<'image' | 'text'>('image')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const receipt = receipts[currentIndex]

  if (!receipt) {
    return <div className="text-center text-gray-500">No receipts to review</div>
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Parse from:</span>
          <select
            value={parseMode}
            onChange={(e) => setParseMode(e.target.value as 'image' | 'text')}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="image">Image</option>
            <option value="text">Text Only</option>
          </select>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Image Preview */}
        <div className="flex-shrink-0">
          {(receipt.image_base64 || receipt.thumbnail_base64) ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="block cursor-zoom-in group relative"
              aria-label="Click to view full size"
            >
              <img
                src={`data:image/png;base64,${receipt.image_base64 || receipt.thumbnail_base64}`}
                alt={receipt.filename}
                className="w-80 max-h-96 object-contain rounded border group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Click to enlarge
                </span>
              </div>
            </button>
          ) : (
            <div className="w-80 h-64 bg-gray-100 rounded border flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                {receipt.processing ? 'Processing...' : 'No preview'}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1 truncate w-80">
            {receipt.filename}
          </p>
        </div>

        {/* Parsed data & input */}
        <div className="flex-1 space-y-4">
          {/* Error display */}
          {receipt.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {receipt.error}
            </div>
          )}

          {/* Processing indicator */}
          {receipt.processing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing with VLM...
            </div>
          )}

          {/* Parsed data */}
          {receipt.parsed && !receipt.processing && (
            <div className="p-4 bg-gray-50 rounded border">
              <h3 className="font-medium text-sm text-gray-700 mb-3">
                Extracted Data:
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="font-medium">{receipt.parsed.expense_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>{' '}
                  <span className="font-medium">
                    {receipt.parsed.amount} {receipt.parsed.currency}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>{' '}
                  <span className="font-medium">{receipt.parsed.date}</span>
                </div>
                <div>
                  <span className="text-gray-500">Vendor:</span>{' '}
                  <span className="font-medium">{receipt.parsed.vendor}</span>
                </div>
                {receipt.parsed.guest_count && (
                  <div>
                    <span className="text-gray-500">Guests:</span>{' '}
                    <span className="font-medium">{receipt.parsed.guest_count}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Confidence:</span>{' '}
                  <span
                    className={`font-medium ${
                      receipt.parsed.confidence === 'high'
                        ? 'text-green-600'
                        : receipt.parsed.confidence === 'low'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {receipt.parsed.confidence}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <span className="text-gray-500 text-sm">Description:</span>
                <p className="mt-1 text-sm">{receipt.parsed.description}</p>
              </div>
            </div>
          )}

          {/* User input for refinement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your input / refinement:
            </label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                parseMode === 'text'
                  ? 'Describe the receipt: "Train ticket from SD to LA, $45, Dec 4th, Amtrak"'
                  : 'Corrections: "Split bill 6 ways, my share is $33.27"'
              }
              className="w-full px-3 py-2 border rounded text-sm"
              rows={3}
            />
            <button
              onClick={handleReparse}
              disabled={!userInput.trim() || receipt.processing}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {receipt.processing && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {receipt.processing ? 'Processing...' : 'Re-parse'}
            </button>
          </div>
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
          onClick={() =>
            onIndexChange(Math.min(receipts.length - 1, currentIndex + 1))
          }
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
