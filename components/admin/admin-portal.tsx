'use client'

import { useMemo, useState, useTransition } from 'react'
import { differenceInDays, format, parseISO } from 'date-fns'
import { Download, Plus, RefreshCcw, Upload } from 'lucide-react'
import type { Tables } from '@/lib/database.types'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabaseClient'
import { generateJobsAction } from '@/app/admin/actions'
import { parseLatLng } from '@/lib/utils'
import { ClientJobMap } from '@/components/client/client-job-map'
import type { ClientJob, ClientProperty } from '@/components/client/types'

export type AdminPortalData = {
  profile: Tables<'user_profile'>
  clients: Tables<'client_list'>[]
  jobs: Tables<'jobs'>[]
  logs: Tables<'logs'>[]
  users: Tables<'user_profile'>[]
}

type EditableClient = Tables<'client_list'>

function computeJobStatus(job: Tables<'jobs'>, logs: Tables<'logs'>[]) {
  const jobLogs = logs.filter((log) => log.job_id === job.id)
  if (jobLogs.some((log) => !!log.photo_path)) return 'Completed'
  if (jobLogs.some((log) => !!log.gps_lat && !log.photo_path)) return 'In Progress'
  return 'Pending'
}

export function AdminPortal({ data }: { data: AdminPortalData }) {
  const [clients, setClients] = useState<EditableClient[]>(data.clients)
  const [jobs] = useState(data.jobs)
  const [logs] = useState(data.logs)
  const [users, setUsers] = useState(data.users)
  const [isGenerating, startGenerate] = useTransition()
  const [newClient, setNewClient] = useState<Partial<EditableClient>>({})
  const [editing, setEditing] = useState<EditableClient | null>(null)
  const [selectedStaffForReplay, setSelectedStaffForReplay] = useState<string>('')

  const staffUsers = useMemo(() => users.filter((user) => user.role === 'staff'), [users])

  const logsByJob = useMemo(() => {
    return logs.reduce<Record<string, Tables<'logs'>[]>>((acc, log) => {
      if (!log.job_id) return acc
      acc[log.job_id] = acc[log.job_id] ? [...acc[log.job_id], log] : [log]
      return acc
    }, {})
  }, [logs])

  const today = format(new Date(), 'EEEE').toLowerCase()
  const jobsToday = jobs.filter((job) => job.day_of_week?.toLowerCase() === today)
  const jobsCompletedToday = jobsToday.filter((job) => logsByJob[job.id]?.some((log) => !!log.photo_path))
  const completionRate = jobsToday.length
    ? Math.round((jobsCompletedToday.length / jobsToday.length) * 100)
    : 0
  const activeClients = clients.filter((client) => !!client.membership_start)
  const trialClients = clients.filter((client) => !client.membership_start && !!client.trial_start)
  const monthlyRevenue = clients.reduce((acc, client) => acc + (client.price_per_month ?? 0), 0)

  const pendingJobs = jobs.filter((job) => computeJobStatus(job, logs) === 'Pending')
  const inProgressJobs = jobs.filter((job) => computeJobStatus(job, logs) === 'In Progress')
  const completedJobs = jobs.filter((job) => computeJobStatus(job, logs) === 'Completed')

  const missedJobs = jobs.filter((job) => {
    if (!job.day_of_week) return false
    const jobLogs = logsByJob[job.id] ?? []
    if (jobLogs.some((log) => log.photo_path)) return false
    const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(
      job.day_of_week.toLowerCase()
    )
    const todayIndex = new Date().getDay()
    return dayIndex < todayIndex
  })

  const issues = logs.filter((log) => log.notes?.startsWith('Issue'))

  const staffPerformance = useMemo(() => {
    return staffUsers.map((staff) => {
      const staffLogs = logs.filter((log) => log.user_id === staff.user_id)
      const completed = staffLogs.filter((log) => !!log.photo_path)
      const last7 = staffLogs.filter((log) => {
        if (!log.done_on) return false
        return differenceInDays(new Date(), parseISO(log.done_on)) <= 7
      })
      const last30 = staffLogs.filter((log) => {
        if (!log.done_on) return false
        return differenceInDays(new Date(), parseISO(log.done_on)) <= 30
      })
      const firstGps = staffLogs
        .filter((log) => log.gps_time)
        .map((log) => parseISO(log.gps_time!))
        .sort((a, b) => a.getTime() - b.getTime())[0]
      const lastProof = completed
        .map((log) => (log.done_on ? parseISO(log.done_on) : null))
        .filter((value): value is Date => !!value)
        .sort((a, b) => b.getTime() - a.getTime())[0]
      const avgCompletion = staffLogs.length
        ? Math.round((completed.length / staffLogs.length) * 100)
        : 0
      return {
        staff,
        weeklyJobs: last7.length,
        monthlyJobs: last30.length,
        avgCompletion,
        lastActive: lastProof ?? firstGps ?? null,
      }
    })
  }, [staffUsers, logs])

  const riderReplay = useMemo(() => {
    if (!selectedStaffForReplay) return []
    return logs
      .filter((log) => log.user_id === selectedStaffForReplay && log.gps_time)
      .sort((a, b) => (a.gps_time ?? '').localeCompare(b.gps_time ?? ''))
  }, [logs, selectedStaffForReplay])

  const jobsForMap: ClientJob[] = useMemo(
    () =>
      jobs.map((job) => ({
        ...job,
        status: 'pending' as const,
        logs: logsByJob[job.id] ?? [],
      })),
    [jobs, logsByJob]
  )

  const propertiesForMap: ClientProperty[] = useMemo(
    () =>
      clients.map((client) => {
        const assigned = users.find((user) => user.user_id === client.assigned_to)
        return {
          ...client,
          assigned_staff: assigned ? { user_id: assigned.user_id, full_name: assigned.full_name } : null,
          coordinates: parseLatLng(client.lat_lng),
        }
      }),
    [clients, users]
  )

  const handleCreateClient = async () => {
    const { data, error } = await supabase
      .from('client_list')
      .insert({
        ...newClient,
        price_per_month: Number(newClient.price_per_month) || null,
      })
      .select()
      .single()

    if (!error && data) {
      setClients((prev) => [...prev, data])
      setNewClient({})
    }
  }

  const handleUpdateClient = async () => {
    if (!editing) return
    const { data, error } = await supabase
      .from('client_list')
      .update(editing)
      .eq('id', editing.id)
      .select()
      .single()
    if (!error && data) {
      setClients((prev) => prev.map((client) => (client.id === data.id ? data : client)))
      setEditing(null)
    }
  }

  const handleDeleteClient = async (id: string) => {
    await supabase.from('client_list').delete().eq('id', id)
    setClients((prev) => prev.filter((client) => client.id !== id))
  }

  const handleAssignStaff = async (clientId: string, staffId: string) => {
    await supabase.from('client_list').update({ assigned_to: staffId }).eq('id', clientId)
    setClients((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, assigned_to: staffId } : client))
    )
  }

  const handleBulkImport = async (file: File) => {
    const text = await file.text()
    const [header, ...rows] = text.split('\n').filter(Boolean)
    const columns = header.split(',').map((column) => column.trim())
    const inserts = rows.map((row) => {
      const values = row.split(',').map((value) => value.trim())
      return columns.reduce<Record<string, any>>((acc, column, index) => {
        acc[column] = values[index] ?? null
        return acc
      }, {})
    })
    if (!inserts.length) return
    await supabase.from('client_list').insert(inserts)
    setClients((prev) => [...prev, ...(inserts as EditableClient[])])
  }

  const handleRoleChange = async (userId: string, role: string) => {
    await supabase.from('user_profile').update({ role }).eq('user_id', userId)
    setUsers((prev) => prev.map((user) => (user.user_id === userId ? { ...user, role } : user)))
  }

  const handleExportLogs = async () => {
    const csv = ['Job ID,Client,Address,Bins,Date,Notes']
    logs.forEach((log) => {
      csv.push(
        [log.job_id, log.client_name, log.address, log.bins, log.done_on, (log.notes ?? '').replace(/\n/g, ' ')].join(',')
      )
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'binbird-admin-logs.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const issuesByProperty = useMemo(() => {
    return issues.reduce<Record<string, number>>((acc, log) => {
      if (!log.address) return acc
      acc[log.address] = (acc[log.address] ?? 0) + 1
      return acc
    }, {})
  }, [issues])

  return (
    <div className="space-y-16">
      <section id="dashboard" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Jobs today</CardDescription>
            <CardTitle>{jobsToday.length}</CardTitle>
          </CardHeader>
          <CardContent>{format(new Date(), 'EEE d MMM')}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Completion</CardDescription>
            <CardTitle>{completionRate}%</CardTitle>
          </CardHeader>
          <CardContent>{jobsCompletedToday.length} finished runs</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active vs trial</CardDescription>
            <CardTitle>
              {activeClients.length}/{trialClients.length}
            </CardTitle>
          </CardHeader>
          <CardContent>Active members vs trials</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Monthly revenue</CardDescription>
            <CardTitle>${monthlyRevenue.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>Based on client pricing.</CardContent>
        </Card>
      </section>

      <section id="properties" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Properties</h2>
          <div className="flex gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <Upload className="h-4 w-4" />
              Bulk CSV
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleBulkImport(file)
                }}
              />
            </label>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> New property
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New property</DialogTitle>
                  <DialogDescription>Create a new client property.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Client name"
                    value={newClient.client_name ?? ''}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, client_name: event.target.value }))}
                  />
                  <Input
                    placeholder="Email"
                    value={newClient.email ?? ''}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value }))}
                  />
                  <Textarea
                    placeholder="Address"
                    value={newClient.address ?? ''}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, address: event.target.value }))}
                  />
                  <Input
                    placeholder="Price per month"
                    value={newClient.price_per_month?.toString() ?? ''}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, price_per_month: Number(event.target.value) }))}
                  />
                  <Button onClick={handleCreateClient}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Price</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-semibold">{client.client_name}</div>
                  <div className="text-xs text-white/50">{client.email}</div>
                </TableCell>
                <TableCell>{client.address}</TableCell>
                <TableCell>
                  <select
                    className="rounded-md bg-black/40 px-2 py-1"
                    value={client.assigned_to ?? ''}
                    onChange={(event) => handleAssignStaff(client.id, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map((staff) => (
                      <option key={staff.user_id} value={staff.user_id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>${client.price_per_month ?? 0}</TableCell>
                <TableCell className="space-x-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(client)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(client.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ClientJobMap jobs={jobsForMap} properties={propertiesForMap} />
      </section>

      <section id="jobs" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Jobs</h2>
          <Button
            disabled={isGenerating}
            onClick={() =>
              startGenerate(async () => {
                await generateJobsAction()
              })
            }
            className="flex items-center gap-2"
          >
            <RefreshCcw className={isGenerating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Generate jobs
          </Button>
        </div>
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Full list</TabsTrigger>
            <TabsTrigger value="status">Status board</TabsTrigger>
            <TabsTrigger value="missed">Missed</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.client_name}</TableCell>
                    <TableCell>{job.address}</TableCell>
                    <TableCell>{users.find((user) => user.user_id === job.assigned_to)?.full_name ?? 'Unassigned'}</TableCell>
                    <TableCell>{job.job_type}</TableCell>
                    <TableCell>{computeJobStatus(job, logs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="status">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Pending</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingJobs.map((job) => (
                    <div key={job.id} className="rounded-lg bg-white/5 p-3 text-sm text-white/80">
                      {job.address}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>In Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {inProgressJobs.map((job) => (
                    <div key={job.id} className="rounded-lg bg-white/5 p-3 text-sm text-white/80">
                      {job.address}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Completed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {completedJobs.map((job) => (
                    <div key={job.id} className="rounded-lg bg-white/5 p-3 text-sm text-white/80">
                      {job.address}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="missed">
            <Card>
              <CardHeader>
                <CardTitle>Missed jobs</CardTitle>
                <CardDescription>Jobs with no proof uploaded after scheduled day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {missedJobs.length === 0 ? (
                  <p className="text-sm text-white/60">No missed jobs 🎉</p>
                ) : (
                  missedJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                      <span>{job.address}</span>
                      <Badge variant="danger">{job.day_of_week}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <section id="staff" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Staff management</h2>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Replay</Label>
            <select
              className="rounded-md bg-black/40 px-3 py-2 text-sm"
              value={selectedStaffForReplay}
              onChange={(event) => setSelectedStaffForReplay(event.target.value)}
            >
              <option value="">Select staff</option>
              {staffUsers.map((staff) => (
                <option key={staff.user_id} value={staff.user_id}>
                  {staff.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {staffPerformance.map((record) => (
            <Card key={record.staff.user_id}>
              <CardHeader>
                <CardTitle>{record.staff.full_name}</CardTitle>
                <CardDescription>{record.staff.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/80">
                <div>Jobs (7d): {record.weeklyJobs}</div>
                <div>Jobs (30d): {record.monthlyJobs}</div>
                <div>Completion: {record.avgCompletion}%</div>
                <div>
                  Last active:{' '}
                  {record.lastActive ? format(record.lastActive, 'd MMM HH:mm') : 'No data'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Staff GPS replay</CardTitle>
            <CardDescription>Timeline of GPS pings for the selected staff member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {riderReplay.length === 0 ? (
              <p className="text-sm text-white/60">Select a staff member to replay their run.</p>
            ) : (
              riderReplay.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                  <span>{format(parseISO(log.gps_time ?? new Date().toISOString()), 'HH:mm:ss')}</span>
                  <span>
                    {log.gps_lat?.toFixed(4)}, {log.gps_lng?.toFixed(4)} ({log.gps_acc ?? 0}m)
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section id="proofs" className="space-y-6">
        <h2 className="text-2xl font-semibold">Proofs & logs</h2>
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Review queue</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <CardTitle>Pending approval</CardTitle>
                <CardDescription>Proofs uploaded without notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {logs
                  .filter((log) => log.photo_path && !log.notes)
                  .map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                      <span>
                        {log.client_name} • {log.address}
                      </span>
                      <Badge variant="info">{log.done_on}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle>Issues list</CardTitle>
                <CardDescription>Logs flagged by clients.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {issues.length === 0 ? (
                  <p className="text-sm text-white/60">No issues flagged.</p>
                ) : (
                  issues.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                      <span>
                        {log.client_name} • {log.address}
                      </span>
                      <Badge variant="danger">{log.notes}</Badge>
                    </div>
                  ))
                )}
                <Separator />
                <div className="space-y-2">
                  {Object.entries(issuesByProperty).map(([address, count]) => (
                    <div key={address} className="flex items-center justify-between text-sm text-white/70">
                      <span>{address}</span>
                      <Badge variant="warning">{count} issues</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Bulk export</CardTitle>
                <CardDescription>Download CSV for audits or share with councils.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={handleExportLogs} className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <section id="clients" className="space-y-6">
        <h2 className="text-2xl font-semibold">Clients</h2>
        <Card>
          <CardHeader>
            <CardTitle>Trial tracker</CardTitle>
            <CardDescription>Monitor trials vs paid members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm text-white/80">
                <div>
                  <div className="font-semibold">{client.client_name}</div>
                  <div className="text-xs text-white/50">Trial: {client.trial_start ?? '—'}</div>
                </div>
                <Badge variant={client.membership_start ? 'success' : 'warning'}>
                  {client.membership_start ? `Member since ${client.membership_start}` : 'On trial'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Retention</CardTitle>
            <CardDescription>Average membership length and churn.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white/5 p-4 text-sm text-white/80">
              <p className="text-xs uppercase text-white/50">Avg membership length</p>
              <p className="text-2xl font-semibold">
                {(() => {
                  const members = clients.filter((client) => client.membership_start)
                  if (!members.length) return '0 days'
                  const avg =
                    members.reduce((acc, client) => {
                      const start = parseISO(client.membership_start ?? new Date().toISOString())
                      return acc + differenceInDays(new Date(), start)
                    }, 0) / members.length
                  return `${Math.round(avg)} days`
                })()}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4 text-sm text-white/80">
              <p className="text-xs uppercase text-white/50">Churn risk</p>
              <p className="text-2xl font-semibold">{trialClients.length}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-4 text-sm text-white/80">
              <p className="text-xs uppercase text-white/50">Highest issue address</p>
              <p className="text-lg font-semibold">
                {Object.entries(issuesByProperty)[0]?.[0] ?? 'No issues'}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="users" className="space-y-6">
        <h2 className="text-2xl font-semibold">Users</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <select
                    value={user.role ?? 'client'}
                    onChange={(event) => handleRoleChange(user.user_id, event.target.value)}
                    className="rounded-md bg-black/40 px-3 py-2 text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="client">Client</option>
                  </select>
                </TableCell>
                <TableCell>{user.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section id="settings" className="space-y-6">
        <h2 className="text-2xl font-semibold">Settings & automation</h2>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure alerts and escalation workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Enable nightly summary email</p>
            </div>
            <Switch checked disabled aria-readonly="true" />
          </CardContent>
          <CardFooter className="text-xs text-white/50">
            TODO: Wire into notification microservice.
          </CardFooter>
        </Card>
      </section>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit property</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <Input
                value={editing.client_name ?? ''}
                onChange={(event) => setEditing({ ...editing, client_name: event.target.value })}
              />
              <Textarea
                value={editing.address ?? ''}
                onChange={(event) => setEditing({ ...editing, address: event.target.value })}
              />
              <Input
                value={editing.price_per_month?.toString() ?? ''}
                onChange={(event) => setEditing({ ...editing, price_per_month: Number(event.target.value) })}
              />
              <Button onClick={handleUpdateClient}>Save</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
