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
  is_non_uk_eu: boolean
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
  foreign_currency: string
  exchange_rate: string
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
      foreign_currency: 'USD',
      exchange_rate: '0.79',
    }
  })
  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
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
    const toProcess = receipts
      .map((r, idx) => ({ receipt: r as Receipt & { file?: File }, idx }))
      .filter(({ receipt }) => !receipt.parsed && receipt.file)

    setProcessingProgress({ current: 0, total: toProcess.length })

    // Mark all as processing
    setReceipts((prev) =>
      prev.map((r, idx) => {
        const isProcessing = toProcess.some((p) => p.idx === idx)
        return isProcessing ? { ...r, processing: true } : r
      })
    )

    let completed = 0
    const MAX_RETRIES = 3

    // Helper to process one receipt with retries
    const processOne = async (receipt: Receipt & { file?: File }, idx: number) => {
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const formData = new FormData()
          formData.append('file', receipt.file!)
          formData.append('mode', 'image')
          formData.append('model', selectedModel)

          const res = await fetch(`${API_URL}/api/parse-receipt`, {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) throw new Error(`HTTP ${res.status}`)

          const data = await res.json()

          // Success - update receipt
          setReceipts((prev) =>
            prev.map((r, i) =>
              i === idx
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
          return // Success, exit retry loop
        } catch (error) {
          lastError = error as Error
          console.log(`Receipt ${idx} attempt ${attempt}/${MAX_RETRIES} failed:`, error)
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000)) // Wait 1s before retry
          }
        }
      }

      // All retries failed - create placeholder for manual entry
      const emptyParsed: ParsedReceipt = {
        expense_type: 'OTHER',
        amount: 0,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        vendor: 'Unknown',
        description: 'Failed to parse after 3 attempts - please fill manually',
        guest_count: null,
        is_group_expense: false,
        confidence: 'low',
      }

      setReceipts((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                parsed: emptyParsed,
                processing: false,
                error: `Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
              }
            : r
        )
      )
    }

    // Process all in parallel
    const promises = toProcess.map(async ({ receipt, idx }) => {
      await processOne(receipt, idx)
      completed++
      setProcessingProgress({ current: completed, total: toProcess.length })
    })

    await Promise.all(promises)

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

                {processing ? (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Processing receipts...
                      </span>
                      <span className="text-sm text-gray-600">
                        {processingProgress.current}/{processingProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${processingProgress.total > 0 ? (processingProgress.current / processingProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={processAllReceipts}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Process All Receipts
                  </button>
                )}
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
