import { useEffect, useRef } from 'react'

export function useLatest(value) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
