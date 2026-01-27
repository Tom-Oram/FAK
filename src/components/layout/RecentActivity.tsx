// src/components/layout/RecentActivity.tsx
import { FileSearch, Globe, ShieldCheck, Route, Gauge, Terminal, Trash2 } from 'lucide-react'
import { useRecentActivity, formatRelativeTime } from '../../hooks'
import type { ActivityItem } from '../../hooks'

const iconMap = {
  pcap: FileSearch,
  dns: Globe,
  ssl: ShieldCheck,
  path: Route,
  iperf: Gauge,
  capture: Terminal,
}

const colorMap = {
  pcap: 'text-blue-500 bg-blue-100 dark:bg-blue-900/50',
  dns: 'text-green-500 bg-green-100 dark:bg-green-900/50',
  ssl: 'text-purple-500 bg-purple-100 dark:bg-purple-900/50',
  path: 'text-orange-500 bg-orange-100 dark:bg-orange-900/50',
  iperf: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/50',
  capture: 'text-pink-500 bg-pink-100 dark:bg-pink-900/50',
}

export default function RecentActivity() {
  const { activity, clearActivity } = useRecentActivity()

  if (activity.length === 0) {
    return (
      <div className="card h-full">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        </div>
        <div className="card-body flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <FileSearch className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">No recent activity</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try analyzing a PCAP file!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        <button
          onClick={clearActivity}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded transition-colors"
          title="Clear history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {activity.map((item, index) => (
            <ActivityRow key={item.id} item={item} isNew={index === 0} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ item, isNew }: { item: ActivityItem; isNew: boolean }) {
  const Icon = iconMap[item.type]
  const colors = colorMap[item.type]

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${isNew ? 'animate-slide-in-right' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 dark:text-white truncate">{item.description}</p>
        {item.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.detail}</p>
        )}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
        {formatRelativeTime(item.timestamp)}
      </span>
    </div>
  )
}
