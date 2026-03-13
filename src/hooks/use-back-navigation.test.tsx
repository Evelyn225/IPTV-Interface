import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useBackNavigation } from './use-back-navigation'

function BackHarness() {
  useBackNavigation()

  return (
    <Routes>
      <Route element={<div>Home Page</div>} path="/" />
      <Route element={<div>Details Page</div>} path="/details/1" />
    </Routes>
  )
}

describe('useBackNavigation', () => {
  it('navigates backward when a back key is pressed', () => {
    render(
      <MemoryRouter initialEntries={['/', '/details/1']} initialIndex={1}>
        <BackHarness />
      </MemoryRouter>,
    )

    expect(screen.getByText('Details Page')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape', which: 27 })
    expect(screen.getByText('Home Page')).toBeInTheDocument()
  })
})
