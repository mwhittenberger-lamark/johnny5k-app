import { useEffect, useState } from 'react'
import { readRecentIronQuestMissionUpdate } from '../lib/ironquestRecentMissionUpdate'
import { subscribeIronQuestStateChanged } from '../lib/ironquestSync'

export function useIronQuestRecentMissionUpdate() {
  const [recentMissionUpdate, setRecentMissionUpdate] = useState(() => readRecentIronQuestMissionUpdate())

  useEffect(() => {
    return subscribeIronQuestStateChanged(() => {
      setRecentMissionUpdate(readRecentIronQuestMissionUpdate())
    })
  }, [])

  return recentMissionUpdate
}
