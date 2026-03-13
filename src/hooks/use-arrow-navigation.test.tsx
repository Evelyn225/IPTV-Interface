import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useArrowNavigation } from './use-arrow-navigation'

function FocusHarness() {
  useArrowNavigation()

  return (
    <div>
      <button data-focusable="true" type="button">
        Left
      </button>
      <button data-focusable="true" type="button">
        Right
      </button>
      <button data-focusable="true" type="button">
        Down
      </button>
    </div>
  )
}

describe('useArrowNavigation', () => {
  it('moves focus to the nearest candidate in the pressed direction', () => {
    render(<FocusHarness />)

    const left = screen.getByRole('button', { name: 'Left' })
    const right = screen.getByRole('button', { name: 'Right' })
    const down = screen.getByRole('button', { name: 'Down' })

    for (const [element, rect] of [
      [left, { left: 0, top: 0, width: 100, height: 40 }],
      [right, { left: 140, top: 0, width: 100, height: 40 }],
      [down, { left: 0, top: 100, width: 100, height: 40 }],
    ] as const) {
      Object.defineProperty(element, 'offsetParent', { configurable: true, value: document.body })
      element.getBoundingClientRect = () => ({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => rect,
      }) as DOMRect
    }

    left.focus()
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(right).toHaveFocus()

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(left).toHaveFocus()

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(down).toHaveFocus()
  })
})
