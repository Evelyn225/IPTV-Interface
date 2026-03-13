import { useEffect, useEffectEvent } from 'react'

function isFocusableElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement
}

function isTextInput(target: HTMLElement) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable
}

function getFocusableElements() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-focusable="true"]:not([disabled])')).filter(
    (element) => element.offsetParent !== null,
  )
}

function distanceScore(activeRect: DOMRect, candidateRect: DOMRect, direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') {
  const activeX = activeRect.left + activeRect.width / 2
  const activeY = activeRect.top + activeRect.height / 2
  const candidateX = candidateRect.left + candidateRect.width / 2
  const candidateY = candidateRect.top + candidateRect.height / 2

  const horizontal = candidateX - activeX
  const vertical = candidateY - activeY

  if (direction === 'ArrowRight' && horizontal <= 0) return Number.POSITIVE_INFINITY
  if (direction === 'ArrowLeft' && horizontal >= 0) return Number.POSITIVE_INFINITY
  if (direction === 'ArrowDown' && vertical <= 0) return Number.POSITIVE_INFINITY
  if (direction === 'ArrowUp' && vertical >= 0) return Number.POSITIVE_INFINITY

  const primary = direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(horizontal) : Math.abs(vertical)
  const secondary = direction === 'ArrowLeft' || direction === 'ArrowRight' ? Math.abs(vertical) : Math.abs(horizontal)

  return primary + secondary * 0.35
}

export function useArrowNavigation() {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return
    }

    if (isFocusableElement(event.target) && isTextInput(event.target)) {
      return
    }

    const focusables = getFocusableElements()
    if (!focusables.length) {
      return
    }

    const activeElement = isFocusableElement(document.activeElement) ? document.activeElement : null
    if (!activeElement || !focusables.includes(activeElement)) {
      event.preventDefault()
      focusables[0].focus()
      return
    }

    const activeRect = activeElement.getBoundingClientRect()
    const next = focusables
      .filter((element) => element !== activeElement)
      .map((element) => ({
        element,
        score: distanceScore(activeRect, element.getBoundingClientRect(), event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'),
      }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .toSorted((left, right) => left.score - right.score)[0]

    if (!next) {
      return
    }

    event.preventDefault()
    next.element.focus()
    next.element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  })

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
