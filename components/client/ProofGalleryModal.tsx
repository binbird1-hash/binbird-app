'use client'

import { useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export type ProofGalleryModalProps = {
  isOpen: boolean
  photoKeys: string[]
  onClose: () => void
}

export function ProofGalleryModal({ isOpen, photoKeys, onClose }: ProofGalleryModalProps) {
  const supabase = useSupabase()
  const [urls, setUrls] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      if (photoKeys.length === 0) {
        setUrls([])
        setLoading(false)
        return
      }
      const { data, error } = await supabase.storage.from('proofs').createSignedUrls(photoKeys, 60 * 60)
      if (error) {
        console.warn('Failed to fetch proof URLs', error)
        setUrls([])
      } else {
        setUrls(data?.map((entry) => entry.signedUrl).filter(Boolean) as string[])
      }
      if (!cancelled) {
        setIndex(0)
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [isOpen, photoKeys, supabase])

  useEffect(() => {
    if (index >= urls.length) {
      setIndex(0)
    }
  }, [urls, index])

  const goPrevious = () => setIndex((current) => (current === 0 ? urls.length - 1 : current - 1))
  const goNext = () => setIndex((current) => (current + 1) % urls.length)

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-90"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-90"
            >
              <Dialog.Panel className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-black/90 text-white shadow-2xl max-h-[90vh]">
                <div className="w-full bg-black/60">
                  {loading ? (
                    <div className="flex min-h-[260px] items-center justify-center text-white/70 sm:min-h-[320px]">
                      Fetching proof of service…
                    </div>
                  ) : urls.length === 0 ? (
                    <div className="flex min-h-[260px] items-center justify-center text-white/60 sm:min-h-[320px]">
                      No proof images available yet.
                    </div>
                  ) : (
                    <div className="relative flex w-full items-center justify-center px-4 py-6 sm:px-8 sm:py-8">
                      <img
                        src={urls[index]}
                        alt={`Proof photo ${index + 1}`}
                        className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
                      />
                      {urls.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={goPrevious}
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/70 transition hover:border-binbird-red hover:text-white sm:left-4"
                            aria-label="Previous photo"
                          >
                            <ArrowLeftIcon className="h-6 w-6" />
                          </button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/70 transition hover:border-binbird-red hover:text-white sm:right-4"
                            aria-label="Next photo"
                          >
                            <ArrowRightIcon className="h-6 w-6" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {urls.length > 1 && (
                  <div className="flex items-center justify-center gap-2 bg-black/80 px-6 py-4">
                    {urls.map((url, dotIndex) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setIndex(dotIndex)}
                        className={
                          'h-2.5 w-2.5 rounded-full transition ' +
                          (dotIndex === index ? 'bg-binbird-red' : 'bg-white/30 hover:bg-white/50')
                        }
                        aria-label={`View photo ${dotIndex + 1}`}
                      />
                    ))}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
