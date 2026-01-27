// src/hooks/useRecentActivity.ts
import { useState, useCallback, useEffect } from 'react'

export interface ActivityItem {
  id: string
  type: 'pcap' | 'dns' | 'ssl' | 'path' | 'iperf' | 'capture'
  description: string
  detail?: string
  timestamp: number
}

const STORAGE_KEY = 'fak-recent-activity'
const MAX_ITEMS = 20

function loadActivity(): ActivityItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function useRecentActivity() {
  const [activity, setActivity] = useState<ActivityItem[]>(loadActivity)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activity))
  }, [activity])

  const addActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newItem: ActivityItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    setActivity(prev => [newItem, ...prev].slice(0, MAX_ITEMS))
  }, [])

  const clearActivity = useCallback(() => {
    setActivity([])
  }, [])

  return {
    activity,
    addActivity,
    clearActivity,
  }
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)} days ago`
}
