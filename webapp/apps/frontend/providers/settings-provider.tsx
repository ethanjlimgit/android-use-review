"use client"

import { createContext, useContext, ReactNode, useEffect, useState } from "react"

// Default fallback settings
export const DEFAULT_SETTINGS = {
  "site.name": "AndroidUse",
  "url.playstore.internal.test": "https://play.google.com/apps/internaltest/4701595801771861010",
  "url.playstore.closed.beta": "https://play.google.com/apps/testing/com.androiduse.autopilot",
  "url.beta.google.group": "https://groups.google.com/g/boris-close-beta-testing",
  "url.social.github": "https://github.com/Action-State-Labs/",
  "url.social.twitter": "https://x.com/actionstatelabs",
  "url.social.linkedin": "https://www.linkedin.com/company/actionstatelabs/",
  "url.social.discord": "https://discord.gg/bbZKQXrhzd",
} as const

type SettingsKeys = keyof typeof DEFAULT_SETTINGS
type Settings = Record<string, string>

interface SettingsContextType {
  settings: Settings
  isLoading: boolean
  getSetting: (key: SettingsKeys) => string
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: ReactNode
  initialSettings?: Settings
}

export function SettingsProvider({ children, initialSettings }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings || DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(!initialSettings)

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        const fetchedSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
        setSettings(fetchedSettings)
      }
    } catch (error) {
      console.error("Failed to fetch settings, using defaults:", error)
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!initialSettings) {
      fetchSettings()
    }
  }, [initialSettings])

  const getSetting = (key: SettingsKeys): string => {
    return settings[key] || DEFAULT_SETTINGS[key]
  }

  const refreshSettings = async () => {
    setIsLoading(true)
    await fetchSettings()
  }

  return (
    <SettingsContext.Provider value={{ settings, isLoading, getSetting, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
