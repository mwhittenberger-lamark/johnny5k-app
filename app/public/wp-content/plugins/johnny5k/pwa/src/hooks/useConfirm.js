import { useCallback } from 'react'
import { confirmGlobalAction } from '../lib/uiFeedback'

export function useConfirm() {
  return useCallback((input = {}) => confirmGlobalAction(input), [])
}
