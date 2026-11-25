import { useEffect, useRef } from 'react'

const edgeMargin = 48

export function useBoardDragScroll(active: boolean) {
  const viewport = useRef<HTMLDivElement>(null)
  const direction = useRef(0)

  useEffect(() => {
    if (!active) return
    let frame = 0
    function scroll() {
      if (viewport.current && direction.current) viewport.current.scrollLeft += direction.current * 12
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    return () => {
      cancelAnimationFrame(frame)
      direction.current = 0
    }
  }, [active])

  return {
    viewport,
    scrollNearEdge(clientX: number) {
      const bounds = viewport.current?.getBoundingClientRect()
      if (!bounds) return
      direction.current = clientX < bounds.left + edgeMargin ? -1 : clientX > bounds.right - edgeMargin ? 1 : 0
    },
    stopScrolling: () => { direction.current = 0 },
  }
}
