import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

export default function AiScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)

  useEffect(() => {
    const starterPrompt = location.state?.starterPrompt
    openDrawer(starterPrompt)
    navigate('/dashboard', { replace: true })
  }, [location.state?.starterPrompt, navigate, openDrawer])

  return null
}
