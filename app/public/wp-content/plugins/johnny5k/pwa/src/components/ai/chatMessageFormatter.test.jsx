import { describe, expect, it } from 'vitest'

import { parseChatMessageBlocks, renderChatMessageBlocks } from './chatMessageFormatter'

describe('parseChatMessageBlocks', () => {
  it('preserves ordered list numbers when ordered lists are split by bullets', () => {
    const blocks = parseChatMessageBlocks('1. First step\n\n- Supporting detail\n\n2. Second step')

    expect(blocks).toEqual([
      {
        type: 'ol',
        items: [{ text: 'First step', number: 1 }],
      },
      {
        type: 'ul',
        items: [{ text: 'Supporting detail' }],
      },
      {
        type: 'ol',
        items: [{ text: 'Second step', number: 2 }],
      },
    ])
  })

  it('keeps explicit restarts at one when the model starts a new sequence', () => {
    const blocks = parseChatMessageBlocks('1. First sequence\n\n1. New sequence')

    expect(blocks).toEqual([
      {
        type: 'ol',
        items: [{ text: 'First sequence', number: 1 }],
      },
      {
        type: 'ol',
        items: [{ text: 'New sequence', number: 1 }],
      },
    ])
  })
})

describe('renderChatMessageBlocks', () => {
  it('renders ordered list blocks with preserved start and item values', () => {
    const rendered = renderChatMessageBlocks('1. First step\n\n- Supporting detail\n\n2. Second step')
    const firstList = rendered[0]
    const secondList = rendered[2]

    expect(firstList.type).toBe('ol')
    expect(firstList.props.start).toBe(1)
    expect(firstList.props.children[0].props.value).toBe(1)

    expect(secondList.type).toBe('ol')
    expect(secondList.props.start).toBe(2)
    expect(secondList.props.children[0].props.value).toBe(2)
  })
})