import { requestToUrl, WP_CORE_BASE } from '../core/restClient'

export const mediaApi = {
  list: ({ search = '', page = 1, perPage = 24 } = {}) => {
    const params = new URLSearchParams()
    params.set('context', 'edit')
    params.set('orderby', 'date')
    params.set('order', 'desc')
    params.set('page', String(page))
    params.set('per_page', String(perPage))
    if (search.trim()) params.set('search', search.trim())
    return requestToUrl('GET', `${WP_CORE_BASE}/media?${params.toString()}`, null, false, '/wp/v2/media')
  },
  upload: (file, { title = '' } = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (title.trim()) form.append('title', title.trim())
    return requestToUrl('POST', `${WP_CORE_BASE}/media`, form, true, '/wp/v2/media')
  },
}