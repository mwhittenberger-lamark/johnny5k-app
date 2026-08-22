export const BRAND_STORAGE_KEY = 'jf_brand'
export const DEFAULT_BRAND_ID = 'johnny5k'

const brands = {
  johnny5k: {
    id: 'johnny5k',
    productName: 'Johnny5k',
    shortName: 'J5K',
    tagline: 'Your AI-powered fitness and nutrition coach',
    assistantName: 'Johnny',
    terminology: {
      home: 'Dashboard',
      workout: 'Workout',
      nutrition: 'Nutrition',
      journal: 'Body',
      library: 'Exercise Library',
      character: 'Profile',
      settings: 'Settings',
    },
    tokens: {
      '--brand-primary': '#2374e1',
      '--brand-secondary': '#17a589',
      '--brand-accent': '#ffb020',
      '--brand-surface': '#f5f8fc',
      '--brand-ink': '#172033',
    },
  },
  nat20: {
    id: 'nat20',
    productName: 'Nat20 Fitness',
    shortName: 'Nat20',
    tagline: 'Roll for strength',
    assistantName: 'Grimshaw',
    terminology: {
      home: 'Quest Log',
      workout: "Today's Adventure",
      nutrition: 'The Tavern',
      journal: 'Field Journal',
      library: 'Field Guide',
      character: 'Character Chronicle',
      settings: 'The Runekeeper',
    },
    tokens: {
      '--brand-primary': '#b84b2e',
      '--brand-secondary': '#71558f',
      '--brand-accent': '#d0a94f',
      '--brand-surface': '#e9dcbb',
      '--brand-ink': '#17120f',
    },
  },
}

export function normalizeBrandId(value) {
  const brandId = String(value || '').trim().toLowerCase()
  return brands[brandId] ? brandId : DEFAULT_BRAND_ID
}

export function getBrand(value) {
  return brands[normalizeBrandId(value)]
}

export function resolveBrandId({ runtimeBrand, storedBrand, hostname = '' } = {}) {
  if (brands[String(runtimeBrand || '').trim().toLowerCase()]) {
    return normalizeBrandId(runtimeBrand)
  }

  if (brands[String(storedBrand || '').trim().toLowerCase()]) {
    return normalizeBrandId(storedBrand)
  }

  return String(hostname).toLowerCase().includes('nat20') ? 'nat20' : DEFAULT_BRAND_ID
}

export function resolveInitialBrandId() {
  if (typeof window === 'undefined') return DEFAULT_BRAND_ID

  return resolveBrandId({
    runtimeBrand: window.__JOHNNY5K_BRAND__,
    storedBrand: window.localStorage.getItem(BRAND_STORAGE_KEY),
    hostname: window.location.hostname,
  })
}

export function applyBrand(value, { persist = true } = {}) {
  const brand = getBrand(value)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.dataset.brand = brand.id
    Object.entries(brand.tokens).forEach(([token, tokenValue]) => {
      root.style.setProperty(token, tokenValue)
    })
    document.title = brand.productName
  }

  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(BRAND_STORAGE_KEY, brand.id)
  }

  return brand
}

export function brandTerm(brandOrId, key) {
  const brand = typeof brandOrId === 'object' ? brandOrId : getBrand(brandOrId)
  return brand?.terminology?.[key] || key
}
