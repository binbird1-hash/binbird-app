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
      const bucket = supabase.storage.from('proofs')
      const resolvedKeys: string[] = []

      await Promise.all(
        photoKeys.map(async (key) => {
          const trimmedKey = key.trim()
          if (!trimmedKey) return

          // Detect keys that look like full file paths (contain an extension)
          const hasExtension = /\.[^\/]+$/.test(trimmedKey)
          if (hasExtension) {
            resolvedKeys.push(trimmedKey)
            return
          }

          const directoryPath = trimmedKey.replace(/\/+$/, '')
          const { data: listedFiles, error: listError } = await bucket.list(directoryPath, { limit: 100 })

          if (listError) {
            console.warn('Failed to list proof directory', { key: trimmedKey, error: listError })
            return
          }

          listedFiles
            ?.filter((file) => Boolean(file.name) && !file.name.endsWith('/'))
            .forEach((file) => {
              resolvedKeys.push(`${directoryPath}${directoryPath ? '/' : ''}${file.name}`)
            })
        })
      )

      const uniqueKeys = Array.from(new Set(resolvedKeys))

      if (uniqueKeys.length === 0) {
        setUrls([])
        setLoading(false)
        return
      }

      const { data, error } = await bucket.createSignedUrls(uniqueKeys, 60 * 60)
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
              <Dialog.Panel className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-black/90 text-white shadow-2xl">
                <div className="aspect-video w-full bg-black/60">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-white/70">
                      Fetching proof of service…
                    </div>
                  ) : urls.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-white/60">
                      No proof images available yet.
                    </div>
                  ) : (
                    <div className="relative h-full w-full">
                      <img src={urls[index]} alt={`Proof photo ${index + 1}`} className="h-full w-full object-contain" />
                      {urls.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={goPrevious}
                            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/70 transition hover:border-binbird-red hover:text-white"
                            aria-label="Previous photo"
                          >
                            <ArrowLeftIcon className="h-6 w-6" />
                          </button>
                          <button
                            type="button"
                            onClick={goNext}
                            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/70 transition hover:border-binbird-red hover:text-white"
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
