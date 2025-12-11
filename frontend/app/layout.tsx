import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Expense Receipt Processor',
  description: 'Process receipts and generate expense forms',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
