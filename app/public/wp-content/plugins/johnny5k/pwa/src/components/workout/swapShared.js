import { trainingApi } from '../../api/modules/training'

export function buildPersonalExerciseDraft(exercise = null) {
  return {
    name: String(exercise?.name || '').trim(),
    description: String(exercise?.description || '').trim(),
    primary_muscle: String(exercise?.primary_muscle || '').trim(),
    movement_pattern: String(exercise?.movement_pattern || '').trim(),
    equipment: String(exercise?.equipment || '').trim(),
    difficulty: String(exercise?.difficulty || 'beginner').trim() || 'beginner',
  }
}

export function normalizeLibraryRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeLibraryExercise) : []
}

export function normalizeLibraryExercise(exercise) {
  return {
    ...exercise,
    owned_by_user: isUserOwnedExercise(exercise) ? 1 : 0,
  }
}

export function isUserOwnedExercise(exercise) {
  return Number(exercise?.owned_by_user || 0) === 1 || Number(exercise?.user_id || 0) > 0
}

export function buildExerciseMeta(option) {
  return [option?.primary_muscle, option?.equipment, option?.difficulty]
    .map(humanizeToken)
    .filter(Boolean)
    .join(' · ')
}

export function buildSuggestedExercisePayload({ suggestion, exercise, aiPrompt, dayTypes, slotTypes }) {
  const parsedDayTypes = Array.isArray(dayTypes)
    ? dayTypes
    : parseStringList(exercise?.day_types ?? exercise?.day_types_json)
  const parsedSlotTypes = Array.isArray(slotTypes)
    ? slotTypes
    : parseStringList(exercise?.slot_types ?? exercise?.slot_types_json)

  return {
    name: suggestion.name,
    slug: slugifyExerciseName(suggestion.name),
    description: buildSuggestedExerciseDescription(suggestion, aiPrompt),
    movement_pattern: exercise.movement_pattern || '',
    primary_muscle: exercise.primary_muscle || '',
    equipment: exercise.equipment || 'other',
    difficulty: exercise.difficulty || 'beginner',
    day_types: parsedDayTypes,
    slot_types: parsedSlotTypes,
    active: 1,
  }
}

export async function saveSuggestedExerciseToLibrary({ suggestion, exercise, aiPrompt, dayTypes, slotTypes }) {
  const payload = buildSuggestedExercisePayload({
    suggestion,
    exercise,
    aiPrompt,
    dayTypes,
    slotTypes,
  })
  const result = await trainingApi.savePersonalExercise(payload)
  const savedExerciseId = Number(result?.id)

  if (!savedExerciseId) {
    throw new Error('Johnny could not save that exercise to the library.')
  }

  const baseExerciseId = getSubstitutionBaseExerciseId(exercise)
  if (baseExerciseId > 0 && baseExerciseId !== savedExerciseId) {
    await trainingApi.savePersonalSubstitution({
      exercise_id: baseExerciseId,
      substitute_exercise_id: savedExerciseId,
      reason_code: inferSubstitutionReasonCode({ exercise, aiPrompt }),
      priority: 1,
    })
  }

  const savedExercise = normalizeLibraryExercise({
    id: savedExerciseId,
    name: suggestion.name,
    description: payload.description,
    movement_pattern: payload.movement_pattern,
    primary_muscle: payload.primary_muscle,
    equipment: payload.equipment,
    difficulty: payload.difficulty,
    owned_by_user: 1,
  })

  return { savedExerciseId, savedExercise, payload }
}

export function getSubstitutionBaseExerciseId(exercise) {
  const originalExerciseId = Number(exercise?.original_exercise_id || 0)
  if (originalExerciseId > 0) {
    return originalExerciseId
  }

  return Number(exercise?.exercise_id || 0)
}

export function inferSubstitutionReasonCode({ exercise, aiPrompt }) {
  const prompt = String(aiPrompt || '').toLowerCase()
  const equipment = String(exercise?.equipment || '').toLowerCase()

  if (/shoulder|elbow|wrist|knee|hip|back|pain|hurt|injur|joint/.test(prompt)) {
    return 'joint_friendly'
  }

  if (equipment && prompt.includes('machine')) {
    return 'equipment'
  }

  if (/beginner|easier|simpler|learn|skill|advanced|harder/.test(prompt)) {
    return 'skill_level'
  }

  return 'variation'
}

export function parseAiSwapSuggestions(reply, max = 3) {
  return String(reply || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
    .map(line => {
      const parts = line.split('|')
      if (parts.length >= 2) {
        return {
          name: parts[0].trim(),
          reason: parts.slice(1).join('|').trim(),
        }
      }

      const fallbackParts = line.split(/\s[-:]\s/)
      if (fallbackParts.length >= 2) {
        return {
          name: fallbackParts[0].trim(),
          reason: fallbackParts.slice(1).join(' - ').trim(),
        }
      }

      return {
        name: line.trim(),
        reason: 'Suggested by Johnny based on your prompt.',
      }
    })
    .filter(item => item.name)
    .slice(0, max)
}

export function parseAiSwapReviewReply(reply) {
  const lines = String(reply || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const opinionLine = lines.find(line => /^opinion\s*:/i.test(line)) || ''
  const optionLines = lines.filter(line => line.includes('|'))
  const opinion = opinionLine
    ? opinionLine.replace(/^opinion\s*:/i, '').trim()
    : lines.filter(line => !/^options\s*:/i.test(line) && !line.includes('|')).join(' ').trim()

  return {
    opinion,
    options: optionLines
      .map(line => {
        const parts = line.split('|')
        if (parts.length < 2) {
          return null
        }

        return {
          name: parts[0].trim(),
          reason: parts.slice(1).join('|').trim(),
        }
      })
      .filter(Boolean)
      .slice(0, 4),
  }
}

export async function resolveAiSwapSuggestions(suggestions, exercise, dayType = '') {
  const swapOptions = (exercise.swap_options ?? []).map(option => ({
    id: option.id,
    name: option.name,
    primary_muscle: exercise.primary_muscle,
    equipment: exercise.equipment,
    difficulty: option.difficulty,
  }))

  return Promise.all(suggestions.map(async suggestion => {
    let searchResults = []

    try {
      searchResults = await trainingApi.getExercises({
        q: suggestion.name,
        limit: 8,
        day_type: dayType || '',
        preferred_muscle: exercise.primary_muscle || '',
        preferred_equipment: exercise.equipment || '',
      })
    } catch {
      searchResults = []
    }

    const pool = dedupeExercisePool([
      ...swapOptions,
      ...(Array.isArray(searchResults) ? searchResults : []),
    ]).filter(candidate => Number(candidate.id) !== Number(exercise.exercise_id))

    return {
      ...suggestion,
      match: findBestExerciseMatch(suggestion.name, pool),
    }
  }))
}

export function dedupeExercisePool(items) {
  const seen = new Map()

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.set(item.id, item)
  }

  return Array.from(seen.values())
}

export function buildLocalOptionReason(option, exercise) {
  const reasons = []

  if (option.primary_muscle && option.primary_muscle === exercise.primary_muscle) {
    reasons.push('Hits the same primary muscle.')
  }
  if (option.equipment && option.equipment !== exercise.equipment) {
    reasons.push(`Changes the setup to ${humanizeToken(option.equipment).toLowerCase()}.`)
  }
  if (!reasons.length) {
    reasons.push('Fits the same training slot from your saved exercise library.')
  }

  return reasons.slice(0, 2).join(' ')
}

export function humanizeToken(value) {
  if (!value) return ''
  return String(value).replace(/[_-]+/g, ' ').trim()
}

export function parseStringList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return String(value)
      .split(/[\r\n,]+/)
      .map(item => item.trim())
      .filter(Boolean)
  }
}

function buildSuggestedExerciseDescription(suggestion, aiPrompt) {
  const parts = [String(suggestion?.reason || '').trim(), String(aiPrompt || '').trim()]
    .filter(Boolean)

  return parts.join(' Request context: ')
}

function slugifyExerciseName(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function findBestExerciseMatch(name, pool) {
  const target = normalizeExerciseName(name)
  if (!target) return null

  let bestMatch = null
  let bestScore = 0

  for (const candidate of pool) {
    const candidateName = normalizeExerciseName(candidate?.name)
    if (!candidateName) continue

    let score = 0
    if (candidateName === target) {
      score = 100
    } else if (candidateName.includes(target) || target.includes(candidateName)) {
      score = 82
    } else {
      const targetTokens = tokeniseExerciseName(target)
      const candidateTokens = tokeniseExerciseName(candidateName)
      const overlap = targetTokens.filter(token => candidateTokens.includes(token)).length
      score = overlap * 22

      if (targetTokens[0] && targetTokens[0] === candidateTokens[0]) {
        score += 8
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestScore >= 30 ? bestMatch : null
}

function normalizeExerciseName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokeniseExerciseName(value) {
  return normalizeExerciseName(value)
    .split(' ')
    .filter(token => token.length > 2)
}
