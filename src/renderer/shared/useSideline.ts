import { useEffect, useState } from 'react'
import type { AppState, ToastPayload } from '@shared/types'
import { emptyAppState } from '@shared/types'
import { applyCompanionHudPatch } from '@shared/display'

export const useSideline = (): AppState => {
  const [state, setState] = useState<AppState>(emptyAppState())

  useEffect(() => {
    if (!window.sideline) return
    void window.sideline.getState().then(setState)
    const unsubState = window.sideline.onState(setState)
    const unsubTick = window.sideline.onTick((tick) => {
      setState((current) => ({ ...current, ...tick }))
    })
    const unsubBoards = window.sideline.onBoards((patch) => {
      setState((current) => ({ ...current, ...patch }))
    })
    const unsubLive = window.sideline.onLive((patch) => {
      setState((current) => applyCompanionHudPatch(current, patch))
    })
    return () => {
      unsubState()
      unsubTick()
      unsubBoards()
      unsubLive()
    }
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
