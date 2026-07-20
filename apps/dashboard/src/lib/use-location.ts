import { useSyncExternalStore } from 'react'

function getServerSnapshot() {
  return '/'
}

function getSnapshot() {
  return typeof window !== 'undefined' ? window.location.pathname : '/'
}

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}

export function useLocation(): string {
  return useSyncExternalStore(
    typeof window !== 'undefined' ? subscribe : () => () => {},
    getSnapshot,
    getServerSnapshot,
  )
}
