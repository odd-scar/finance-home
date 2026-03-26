import { useEffect, useState } from 'react'
import * as store from '../store/store'
import { AppState } from '../types'

type StoreActions = Omit<typeof store, 'state' | 'subscribe'>

export function useAppStore(): AppState & StoreActions {
  const [, forceUpdate] = useState(false)

  useEffect(() => {
    const unsub = store.subscribe(() => forceUpdate(v => !v))
    return () => { unsub() }
  }, [])

  const { state, subscribe, ...actions } = store
  return { ...state, ...actions }
}
