'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { Download, MapPin, RefreshCcw, Send } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { getNextDayOfWeek } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { ClientJob, ClientLog, ClientPortalData, ClientProperty } from './types'
import { ClientJobMap } from './client-job-map'

const JOB_STATUS_LABELS: Record<ClientJob['status'], { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', variant: 'info' },
  on_the_way: { label: 'On the way', variant: 'default' },
  arrived: { label: 'Arrived', variant: 'warning' },
  done: { label: 'Done', variant: 'success' },
}

function computeStatus(job: ClientJob, logs: ClientLog[]): ClientJob['status'] {
  if (logs.some((log) => !!log.photo_path)) {
    return 'done'
  }
  if (logs.some((log) => log.gps_lat && !log.photo_path)) {
    return 'arrived'
  }
  if (logs.length > 0) {
    return 'on_the_way'
  }
  return 'pending'
}

function enrichJobs(jobs: ClientJob[], logs: ClientLog[]) {
  const byJob = logs.reduce<Record<string, ClientLog[]>>((acc, log) => {
    if (!log.job_id) return acc
    acc[log.job_id] = acc[log.job_id] ? [...acc[log.job_id], log] : [log]
    return acc
  }, {})
  return jobs.map((job) => ({
    ...job,
    logs: byJob[job.id] ?? [],
    status: computeStatus(job, byJob[job.id] ?? []),
  }))
}

function parseNavPref(navPref: string | null) {
  if (!navPref) return { layout: 'default', notifications: true }
  try {
    const parsed = JSON.parse(navPref)
    return {
      layout: parsed.layout ?? 'default',
      notifications: parsed.notifications ?? true,
    }
  } catch (error) {
    return { layout: navPref, notifications: navPref !== 'notifications_off' }
  }
}

function buildNavPref(value: { layout: string; notifications: boolean }) {
  return JSON.stringify(value)
}

type FeedbackFormState = {
  open: boolean
  jobId: string | null
  defaultNotes: string
}

export function ClientPortal({ data }: { data: ClientPortalData }) {
  const [jobs, setJobs] = useState(() => enrichJobs(data.jobs, data.logs))
  const [logs, setLogs] = useState<ClientLog[]>(data.logs)
  const [properties] = useState<ClientProperty[]>(data.properties)
  const [dateFilter, setDateFilter] = useState(() => ({
    from: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  }))
  const [navPref, setNavPref] = useState(() => parseNavPref(data.profile.nav_pref))
  const [isPending, startTransition] = useTransition()
  const [feedbackState, setFeedbackState] = useState<FeedbackFormState>({
    open: false,
    jobId: null,
    defaultNotes: '',
  })

  const clientNames = useMemo(
    () => Array.from(new Set(properties.map((property) => property.client_name).filter(Boolean))) as string[],
    [properties]
  )

  useEffect(() => {
    const channel = supabase
      .channel('client-logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logs',
          filter: clientNames.length ? `client_name=in.(${clientNames.map((name) => `"${name}"`).join(',')})` : undefined,
        },
        (payload) => {
          setLogs((current) => {
            let next = current
            if (payload.eventType === 'DELETE' && payload.old) {
              next = current.filter((log) => log.id !== payload.old.id)
            } else if (payload.new) {
              const existing = current.find((log) => log.id === payload.new.id)
              if (existing) {
                next = current.map((log) => (log.id === payload.new.id ? (payload.new as ClientLog) : log))
              } else {
                next = [...current, payload.new as ClientLog]
              }
            }
            setJobs((prev) => enrichJobs(prev, next))
            return next
          })
        }
      )
      .subscribe()

    const jobChannel = supabase
      .channel('client-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: clientNames.length ? `client_name=in.(${clientNames.map((name) => `"${name}"`).join(',')})` : undefined,
        },
        (payload) => {
          setJobs((current) => {
            const next = [...current]
            if (payload.eventType === 'DELETE' && payload.old) {
              return next.filter((job) => job.id !== payload.old.id)
            }
            if (payload.new) {
              const existingIndex = next.findIndex((job) => job.id === payload.new.id)
              const existingLogs = existingIndex === -1 ? [] : next[existingIndex].logs
              const normalizedJob = {
                ...(payload.new as ClientJob),
                logs: existingLogs,
                status: computeStatus(payload.new as ClientJob, existingLogs),
              }
              if (existingIndex === -1) {
                next.push(normalizedJob)
              } else {
                next[existingIndex] = normalizedJob
              }
            }
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(jobChannel)
    }
  }, [clientNames])

  const nextBinEvents = useMemo(() => {
    return properties.map((property) => {
      const putOutDate = property.put_bins_out ? getNextDayOfWeek(property.put_bins_out) : null
      const collectionDate = property.collection_day ? getNextDayOfWeek(property.collection_day) : null
      return {
        propertyId: property.id,
        address: property.address,
        putOutDate,
        collectionDate,
      }
    })
  }, [properties])

  const filteredLogs = useMemo(() => {
    const fromDate = parseISO(dateFilter.from)
    const toDate = parseISO(dateFilter.to)
    return logs.filter((log) => {
      if (!log.done_on) return false
      const done = parseISO(log.done_on)
      return isWithinInterval(done, { start: fromDate, end: toDate })
    })
  }, [logs, dateFilter])

  const issues = useMemo(() => logs.filter((log) => log.notes?.startsWith('Issue')), [logs])

  const completionRate = useMemo(() => {
    if (!jobs.length) return 0
    const completed = jobs.filter((job) => job.status === 'done').length
    return Math.round((completed / jobs.length) * 100)
  }, [jobs])

  const totalRevenue = useMemo(
    () =>
      properties.reduce((acc, property) => {
        return acc + (property.price_per_month ?? 0)
      }, 0),
    [properties]
  )

  const handleExportCsv = () => {
    const header = 'Job ID,Client,Address,Bins,Done On,Notes\n'
    const rows = filteredLogs
      .map((log) => {
        const safeNotes = (log.notes ?? '').replace(/\n/g, ' ')
        return [log.job_id, log.client_name, log.address, log.bins, log.done_on, safeNotes].join(',')
      })
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `binbird-logs-${dateFilter.from}-to-${dateFilter.to}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPdf = () => {
    // TODO: integrate PDF generator (e.g. jsPDF). For now open printable view.
    const printable = window.open('', '_blank')
    if (!printable) return
    printable.document.write('<html><head><title>Logs Export</title></head><body>')
    printable.document.write('<h1>BinBird Service Proof</h1>')
    printable.document.write(`<p>Range: ${dateFilter.from} – ${dateFilter.to}</p>`)
    printable.document.write('<table border="1" cellpadding="6" cellspacing="0">')
    printable.document.write('<thead><tr><th>Job</th><th>Client</th><th>Address</th><th>Bins</th><th>Date</th><th>Notes</th></tr></thead>')
    printable.document.write('<tbody>')
    filteredLogs.forEach((log) => {
      printable!.document.write(
        `<tr><td>${log.job_id ?? ''}</td><td>${log.client_name ?? ''}</td><td>${log.address ?? ''}</td><td>${log.bins ?? ''}</td><td>${log.done_on ?? ''}</td><td>${log.notes ?? ''}</td></tr>`
      )
    })
    printable.document.write('</tbody></table></body></html>')
    printable.document.close()
    printable.focus()
    printable.print()
  }

  const handleUpdateSettings = async () => {
    startTransition(async () => {
      const nextPref = buildNavPref(navPref)
      await supabase
        .from('user_profile')
        .update({
          full_name: data.profile.full_name,
          phone: data.profile.phone,
          map_style_pref: data.profile.map_style_pref,
          nav_pref: nextPref,
        })
        .eq('user_id', data.profile.user_id)
    })
  }

  const handleFeedbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const notes = String(formData.get('notes') ?? '')
    const issue = formData.get('issue') === 'on'
    const jobId = feedbackState.jobId
    if (!jobId) return

    const log = logs.find((current) => current.job_id === jobId)
    const updatedNotes = issue && !notes.startsWith('Issue') ? `Issue: ${notes}` : notes
    await supabase.from('logs').update({ notes: updatedNotes }).eq('job_id', jobId)
    setFeedbackState({ open: false, jobId: null, defaultNotes: '' })
  }

  const openFeedback = (jobId: string, currentNotes: string | null) => {
    setFeedbackState({ open: true, jobId, defaultNotes: currentNotes ?? '' })
  }

  const [proofUrls, setProofUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    const loadProofs = async () => {
      const entries = await Promise.all(
        filteredLogs
          .filter((log) => !!log.photo_path)
          .map(async (log) => {
            const path = log.photo_path!
            const bucket = path.includes('/') ? path.split('/')[0] : 'proofs'
            const relativePath = path.includes('/') ? path.split('/').slice(1).join('/') : path
            const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(relativePath, 60 * 30)
            return [log.id, signed?.signedUrl ?? ''] as const
          })
      )
      const map: Record<number, string> = {}
      entries.forEach(([id, url]) => {
        map[id] = url
      })
      setProofUrls(map)
    }
    loadProofs()
  }, [filteredLogs])

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Properties</CardDescription>
            <CardTitle>{properties.length}</CardTitle>
          </CardHeader>
          <CardContent>Your managed bin locations.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Jobs scheduled</CardDescription>
            <CardTitle>{jobs.length}</CardTitle>
          </CardHeader>
          <CardContent>Across all linked properties.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Completion rate</CardDescription>
            <CardTitle>{completionRate}%</CardTitle>
          </CardHeader>
          <CardContent>Updated in real time from proofs.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Issues flagged</CardDescription>
            <CardTitle>{issues.length}</CardTitle>
          </CardHeader>
          <CardContent>Logs starting with “Issue” needing attention.</CardContent>
        </Card>
      </section>

      <section>
        <Tabs defaultValue="properties">
          <TabsList>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="jobs">Job tracker</TabsTrigger>
            <TabsTrigger value="proof">Proof of work</TabsTrigger>
            <TabsTrigger value="history">History & Export</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing overview</CardTitle>
                <CardDescription>Estimated monthly subscription spend.</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                ${totalRevenue.toFixed(2)}
              </CardContent>
            </Card>
            {properties.map((property) => (
              <Card key={property.id}>
                <CardHeader>
                  <CardTitle>{property.address}</CardTitle>
                  <CardDescription>
                    {property.client_name} {property.company ? `• ${property.company}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-white/50">Put bins out</p>
                      <p className="text-base font-semibold">{property.put_bins_out ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/50">Collection day</p>
                      <p className="text-base font-semibold">{property.collection_day ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/50">Assigned staff</p>
                      <p className="text-base font-semibold">{property.assigned_staff?.full_name ?? 'Not yet assigned'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-white/50">Contact</p>
                      <p className="text-base font-semibold">{property.number ?? '—'}</p>
                    </div>
                  </div>
                  {property.notes ? (
                    <p className="rounded-md bg-white/5 p-4 text-sm text-white/70">{property.notes}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-sm text-white/70">
                    <Badge variant="info">Red {property.red_freq ?? 'n/a'} {property.red_flip ? `• Flip ${property.red_flip}` : ''}</Badge>
                    <Badge variant="warning">Yellow {property.yellow_freq ?? 'n/a'} {property.yellow_flip ? `• Flip ${property.yellow_flip}` : ''}</Badge>
                    <Badge variant="success">Green {property.green_freq ?? 'n/a'} {property.green_flip ? `• Flip ${property.green_flip}` : ''}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-4 text-sm text-white/80">
                  {nextBinEvents
                    .filter((event) => event.propertyId === property.id)
                    .map((event) => (
                      <div key={event.propertyId} className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-binbird-red" />
                        <span>
                          Next put out: {event.putOutDate ? format(event.putOutDate, 'EEE d MMM') : '—'} • Next collection:{' '}
                          {event.collectionDate ? format(event.collectionDate, 'EEE d MMM') : '—'}
                        </span>
                      </div>
                    ))}
                </CardFooter>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job tracker</CardTitle>
                <CardDescription>Track real time progress across your service runs.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bins</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="font-semibold">{job.address}</div>
                          <div className="text-xs text-white/50">{job.day_of_week}</div>
                        </TableCell>
                        <TableCell className="capitalize">{job.job_type}</TableCell>
                        <TableCell>
                          <Badge variant={JOB_STATUS_LABELS[job.status].variant}>
                            {JOB_STATUS_LABELS[job.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.bins ?? '—'}</TableCell>
                        <TableCell>{job.notes ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" onClick={() => openFeedback(job.id, job.logs[0]?.notes ?? null)}>
                            Give feedback
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <ClientJobMap jobs={jobs} properties={properties} />
          </TabsContent>

          <TabsContent value="proof" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proof of work</CardTitle>
                <CardDescription>Every photo, note, and location ping captured on the run.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center justify-between text-sm text-white/70">
                        <span>{format(parseISO(log.done_on ?? new Date().toISOString()), 'd MMM yyyy')}</span>
                        <Badge variant="info">{log.bins}</Badge>
                      </div>
                      {proofUrls[log.id] ? (
                        <Image
                          src={proofUrls[log.id]}
                          alt={`Proof for ${log.client_name}`}
                          width={640}
                          height={320}
                          className="h-48 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center rounded-lg bg-black/40 text-white/50">
                          No proof uploaded yet
                        </div>
                      )}
                      <p className="mt-3 text-sm text-white/80">{log.notes ?? 'No notes left yet.'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Filter your service logbook and export to CSV or PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="from">From</Label>
                    <Input
                      id="from"
                      type="date"
                      value={dateFilter.from}
                      onChange={(event) => setDateFilter((prev) => ({ ...prev, from: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="to">To</Label>
                    <Input
                      id="to"
                      type="date"
                      value={dateFilter.to}
                      onChange={(event) => setDateFilter((prev) => ({ ...prev, to: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleExportCsv} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button variant="secondary" onClick={handleExportPdf} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Bins</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.done_on ? format(parseISO(log.done_on), 'd MMM yyyy') : '—'}</TableCell>
                        <TableCell>{log.address}</TableCell>
                        <TableCell>{log.bins}</TableCell>
                        <TableCell>{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile & Preferences</CardTitle>
                <CardDescription>Update how we contact you and how the portal behaves.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    defaultValue={data.profile.full_name ?? ''}
                    onBlur={(event) =>
                      supabase
                        .from('user_profile')
                        .update({ full_name: event.target.value })
                        .eq('user_id', data.profile.user_id)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    defaultValue={data.profile.phone ?? ''}
                    onBlur={(event) =>
                      supabase
                        .from('user_profile')
                        .update({ phone: event.target.value })
                        .eq('user_id', data.profile.user_id)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Notifications</p>
                    <p className="text-xs text-white/60">Toggle email/push service alerts.</p>
                  </div>
                  <Switch
                    checked={navPref.notifications}
                    onCheckedChange={(checked) =>
                      setNavPref((prev) => ({ ...prev, notifications: checked }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="layout">Navigation layout</Label>
                  <select
                    id="layout"
                    className="mt-1 w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                    value={navPref.layout}
                    onChange={(event) => setNavPref((prev) => ({ ...prev, layout: event.target.value }))}
                  >
                    <option value="default">Default</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleUpdateSettings} disabled={isPending} className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4 animate-spin" hidden={!isPending} />
                  Save preferences
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={feedbackState.open} onOpenChange={(open) => setFeedbackState((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            <DialogDescription>Let our riders know how the job went or flag an issue.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFeedbackSubmit}>
            <Textarea name="notes" defaultValue={feedbackState.defaultNotes} placeholder="Leave a quick note" />
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="issue" className="h-4 w-4 rounded border-white/40 bg-black/60" />
              Flag as issue
            </label>
            <div className="flex justify-end gap-3">
              <DialogTrigger asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogTrigger>
              <Button type="submit" className="flex items-center gap-2">
                <Send className="h-4 w-4" /> Submit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
