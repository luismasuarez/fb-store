import { useEffect, useState } from "react"
import { Moon, Sun } from "@/lib/icon"
import { Button } from "@/components/ui/button"

function getInitialDark(): boolean {
  if (typeof window === "undefined") return true
  const stored = localStorage.getItem("theme")
  if (stored === "light") return false
  if (stored === "dark") return true
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(getInitialDark)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark(!dark)}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
