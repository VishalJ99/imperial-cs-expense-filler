'use client'

import { useEffect, useCallback } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

interface Props {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  alt: string
}

export default function ImageModal({ isOpen, onClose, imageSrc, alt }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-80" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center
                   bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white text-2xl"
        aria-label="Close"
      >
        ×
      </button>

      {/* Zoom hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10
                      text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
        Scroll to zoom · Drag to pan · Esc to close
      </div>

      {/* Image container */}
      <div
        className="relative w-full h-full flex items-center justify-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100%',
              height: '100%',
            }}
            contentStyle={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={imageSrc}
              alt={alt}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(100vh - 4rem)' }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  )
}
