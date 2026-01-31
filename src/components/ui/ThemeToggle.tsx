// src/components/ui/ThemeToggle.tsx
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks'

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-purple-100/50 dark:text-purple-300/60 dark:hover:text-purple-200 dark:hover:bg-surface-2 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun
        className={`w-5 h-5 transition-all duration-300 ${
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        } absolute inset-0 m-auto`}
      />
      <Moon
        className={`w-5 h-5 transition-all duration-300 ${
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      />
    </button>
  )
}
