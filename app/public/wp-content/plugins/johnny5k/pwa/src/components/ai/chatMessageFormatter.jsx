export function parseChatMessageBlocks(text) {
  const safeText = typeof text === 'string' ? text : ''
  const lines = safeText.split('\n')
  const blocks = []
  let paragraphLines = []
  let listItems = []
  let listType = null

  function flushParagraph() {
    if (!paragraphLines.length) return
    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join('\n'),
    })
    paragraphLines = []
  }

  function flushList() {
    if (!listItems.length || !listType) return
    blocks.push({
      type: listType,
      items: listItems,
    })
    listItems = []
    listType = null
  }

  lines.forEach(line => {
    const trimmed = line.trim()
    const unorderedMatch = /^[-*]\s+(.+)$/.exec(trimmed)
    const orderedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed)

    if (!trimmed) {
      flushParagraph()
      flushList()
      return
    }

    if (unorderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push({ text: unorderedMatch[1] })
      return
    }

    if (orderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push({
        text: orderedMatch[2],
        number: Number.parseInt(orderedMatch[1], 10),
      })
      return
    }

    flushList()
    paragraphLines.push(line)
  })

  flushParagraph()
  flushList()

  return blocks.length
    ? blocks
    : [{ type: 'paragraph', text: safeText }]
}

export function renderChatMessageBlocks(text) {
  return parseChatMessageBlocks(text).map((block, blockIndex) => {
    if (block.type === 'paragraph') {
      return (
        <p key={`paragraph-${blockIndex}`}>
          {renderMultilineInlineText(block.text, `paragraph-${blockIndex}`)}
        </p>
      )
    }

    const ListTag = block.type
    const listStart = block.type === 'ol' ? block.items[0]?.number : undefined

    return (
      <ListTag
        key={`list-${blockIndex}`}
        start={block.type === 'ol' && Number.isFinite(listStart) ? listStart : undefined}
      >
        {block.items.map((item, itemIndex) => {
          const content = renderMultilineInlineText(item.text, `list-${blockIndex}-${itemIndex}`)
          if (block.type === 'ol') {
            return (
              <li key={`item-${blockIndex}-${itemIndex}`} value={item.number}>
                {content}
              </li>
            )
          }

          return <li key={`item-${blockIndex}-${itemIndex}`}>{content}</li>
        })}
      </ListTag>
    )
  })
}

function renderMultilineInlineText(text, keyPrefix) {
  const lines = text.split('\n')

  return lines.flatMap((line, index) => {
    const nodes = renderInlineEmphasis(line, `${keyPrefix}-line-${index}`)
    if (index === lines.length - 1) return nodes
    return [...nodes, <br key={`${keyPrefix}-br-${index}`} />]
  })
}

function renderInlineEmphasis(text, keyPrefix) {
  const parts = []
  const pattern = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let match
  let lastIndex = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      parts.push(
        <strong key={`${keyPrefix}-strong-em-${match.index}`}>
          <em>{renderInlineEmphasis(match[2], `${keyPrefix}-strong-em-${match.index}`)}</em>
        </strong>,
      )
    } else if (match[3]) {
      parts.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {renderInlineEmphasis(match[3], `${keyPrefix}-strong-${match.index}`)}
        </strong>,
      )
    } else if (match[4]) {
      parts.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {renderInlineEmphasis(match[4], `${keyPrefix}-em-${match.index}`)}
        </em>,
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}