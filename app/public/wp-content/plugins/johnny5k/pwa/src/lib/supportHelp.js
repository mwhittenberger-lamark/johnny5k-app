import { analyticsApi } from '../api/modules/analytics'

export function openSupportGuide(openDrawer, config = {}) {
  const prompt = String(config.prompt || '').trim()
  const guideId = String(config.guideId || '').trim()
  const surface = String(config.surface || config.screen || 'app').trim()
  const screen = String(config.screen || surface || 'support').trim()
  const context = {
    support_mode: 'guided_help',
    support_surface: surface,
    ...(guideId ? { support_guide_id: guideId } : {}),
    ...(config.context || {}),
  }
  const meta = {
    isSupport: true,
    guideId,
    surface,
    screen,
  }

  analyticsApi.event('support_entrypoint_opened', {
    screen,
    context: surface,
    metadata: {
      guide_id: guideId,
      surface,
      source: String(config.source || 'screen_help').trim() || 'screen_help',
    },
  }).catch(() => {})

  openDrawer(prompt, { context, meta })
}