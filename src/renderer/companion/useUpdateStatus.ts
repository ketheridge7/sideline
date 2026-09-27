import { useEffect, useState } from 'react'
import type { UpdateSnapshot } from '@shared/updater'

const idleSnapshot = (): UpdateSnapshot => ({ state: 'idle', currentVersion: '' })

export const useUpdateStatus = (): UpdateSnapshot => {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot>(idleSnapshot)

  useEffect(() => {
    if (!window.sideline) return
    void window.sideline.getUpdateStatus().then(setSnapshot)
    return window.sideline.onUpdate(setSnapshot)
  }, [])

  return snapshot
}
