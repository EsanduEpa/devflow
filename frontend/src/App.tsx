import { useEffect, useState } from 'react'

type Health =
  | { state: 'loading' }
  | { state: 'success'; status: string }
  | { state: 'error' }

export default function App() {
  const [health, setHealth] = useState<Health>({ state: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Health request failed with HTTP ${response.status}`)
        }

        const data = await response.json()
        if (typeof data?.status !== 'string') {
          throw new Error('Invalid health response')
        }

        setHealth({ state: 'success', status: data.status })
      } catch {
        if (!controller.signal.aborted) {
          setHealth({ state: 'error' })
        }
      }
    }

    void checkHealth()
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto max-w-2xl p-6 sm:p-12">
      <h1 className="text-3xl font-bold text-blue-700">DevFlow</h1>
      <p className="mt-3 text-slate-700" role="status">
        {health.state === 'loading' && 'Checking backend…'}
        {health.state === 'success' && `Backend status: ${health.status}`}
        {health.state === 'error' && 'Unable to reach the DevFlow backend.'}
      </p>
    </main>
  )
}
