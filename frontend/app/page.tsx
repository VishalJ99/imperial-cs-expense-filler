'use client'

import { useState, useEffect } from 'react'
import HeaderForm from '@/components/HeaderForm'
import DropZone from '@/components/DropZone'
import ReceiptReview from '@/components/ReceiptReview'
import ModelSelector from '@/components/ModelSelector'

const API_URL = 'http://localhost:8000'

export interface ParsedReceipt {
  expense_type: string
  amount: number
  currency: string
  date: string
  vendor: string
  description: string
  guest_count: number | null
  is_group_expense: boolean
  confidence: string
}

export interface Receipt {
  id: string
  filename: string
  image_base64: string
  thumbnail_base64: string
  parsed: ParsedReceipt | null
  approved: boolean
  processing: boolean
  error: string | null
}

export interface HeaderInfo {
  name: string
  cid: string
  dob: string
  address: string
  postcode: string
  bank_name: string
  bank_branch: string
  sort_code: string
  account_number: string
}

type AppState = 'upload' | 'review'

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedModel, setSelectedModel] = useState('qwen/qwen3-vl-235b-a22b-instruct')
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [headerInfo, setHeaderInfo] = useState<HeaderInfo>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expenseHeaderInfo')
      if (saved) return JSON.parse(saved)
    }
    return {
      name: '',
      cid: '',
      dob: '',
      address: '',
      postcode: '',
      bank_name: '',
      bank_branch: '',
      sort_code: '',
      account_number: '',
    }
  })
  const [processing, setProcessing] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Fetch available models
  useEffect(() => {
    fetch(`${API_URL}/api/models`)
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models)
        if (data.models.length > 0) {
          setSelectedModel(data.models[0].id)
        }
      })
      .catch(console.error)
  }, [])

  // Save header info to localStorage
  useEffect(() => {
    localStorage.setItem('expenseHeaderInfo', JSON.stringify(headerInfo))
  }, [headerInfo])

  const handleFilesAdded = (files: File[]) => {
    const newReceipts: Receipt[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      image_base64: '',
      thumbnail_base64: '',
      parsed: null,
      approved: false,
      processing: false,
      error: null,
      file,
    })) as (Receipt & { file: File })[]

    setReceipts((prev) => [...prev, ...newReceipts])
  }

  const processAllReceipts = async () => {
    setProcessing(true)

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i] as Receipt & { file?: File }
      if (receipt.parsed || !receipt.file) continue

      setReceipts((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, processing: true } : r))
      )

      try {
        const formData = new FormData()
        formData.append('file', receipt.file)
        formData.append('mode', 'image')
        formData.append('model', selectedModel)

        const res = await fetch(`${API_URL}/api/parse-receipt`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) throw new Error('Failed to process receipt')

        const data = await res.json()

        setReceipts((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  image_base64: data.image_base64,
                  thumbnail_base64: data.thumbnail_base64,
                  parsed: data.parsed,
                  processing: false,
                  error: null,
                }
              : r
          )
        )
      } catch (error) {
        setReceipts((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, processing: false, error: (error as Error).message }
              : r
          )
        )
      }
    }

    setProcessing(false)
    setAppState('review')
  }

  const handleReparse = async (index: number, userText: string, mode: 'image' | 'text') => {
    const receipt = receipts[index]

    setReceipts((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, processing: true } : r))
    )

    try {
      const formData = new FormData()
      formData.append('mode', mode)
      formData.append('model', selectedModel)
      formData.append('user_text', userText)
      if (receipt.parsed) {
        formData.append('original_data', JSON.stringify(receipt.parsed))
      }

      const res = await fetch(`${API_URL}/api/reparse`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Failed to reparse')

      const data = await res.json()

      setReceipts((prev) =>
        prev.map((r, idx) =>
          idx === index
            ? { ...r, parsed: data.parsed, processing: false, error: null }
            : r
        )
      )
    } catch (error) {
      setReceipts((prev) =>
        prev.map((r, idx) =>
          idx === index
            ? { ...r, processing: false, error: (error as Error).message }
            : r
        )
      )
    }
  }

  const handleApprove = (index: number) => {
    setReceipts((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, approved: true } : r))
    )
    if (index < receipts.length - 1) {
      setCurrentIndex(index + 1)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header_info: headerInfo,
          receipts: receipts
            .filter((r) => r.approved && r.parsed)
            .map((r) => ({
              filename: r.filename,
              image_base64: r.image_base64,
              parsed: r.parsed,
              approved: r.approved,
            })),
        }),
      })

      if (!res.ok) throw new Error('Failed to generate')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${headerInfo.name.split(' ').pop() || 'Expense'}_expenses.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (error) {
      alert('Error generating: ' + (error as Error).message)
    }

    setGenerating(false)
  }

  const approvedCount = receipts.filter((r) => r.approved).length

  return (
    <main className="flex min-h-screen">
      {/* Left Panel */}
      <div className="w-80 bg-gray-50 border-r p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-4">Expense Processor</h1>

        <HeaderForm headerInfo={headerInfo} onChange={setHeaderInfo} />

        <hr className="my-4" />

        <ModelSelector
          models={models}
          selected={selectedModel}
          onChange={setSelectedModel}
        />
      </div>

      {/* Center Panel */}
      <div className="flex-1 p-6 flex flex-col">
        {appState === 'upload' ? (
          <>
            <DropZone onFilesAdded={handleFilesAdded} />

            {receipts.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {receipts.length} receipt(s) added
                  </span>
                  <button
                    onClick={() => setReceipts([])}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Clear all
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {receipts.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 bg-gray-100 rounded text-xs truncate"
                    >
                      {r.filename}
                    </div>
                  ))}
                </div>

                <button
                  onClick={processAllReceipts}
                  disabled={processing}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {processing ? 'Processing...' : 'Process All Receipts'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <ReceiptReview
              receipts={receipts}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              onReparse={handleReparse}
              onApprove={handleApprove}
            />

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Approved: {approvedCount}/{receipts.length}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAppState('upload')}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Back to Upload
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={generating || approvedCount === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {generating ? 'Generating...' : 'Generate Excel & ZIP'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
