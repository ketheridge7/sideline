import { useEffect, useState } from 'react'
import type { AppState, ToastPayload } from '@shared/types'
import { emptyAppState } from '@shared/types'

export const useSideline = (): AppState => {
  const [state, setState] = useState<AppState>(emptyAppState())

  useEffect(() => {
    if (!window.sideline) return
    void window.sideline.getState().then(setState)
    return window.sideline.onState(setState)
  }, [])

  return state
}

export const useToasts = (): ToastPayload[] => {
  const [toasts, setToasts] = useState<ToastPayload[]>([])

  useEffect(() => {
    if (!window.sideline) return
    return window.sideline.onToast((toast) => {
      setToasts((current) => [toast, ...current].slice(0, 8))
      window.setTimeout(() => {
        setToasts((current) => current.filter((row) => row.id !== toast.id))
      }, 12000)
    })
  }, [])

  return toasts
}
