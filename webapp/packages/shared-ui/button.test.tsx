import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('should apply default variant classes', () => {
    render(<Button>Default</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-primary')
  })

  it('should apply outline variant', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('border')
  })

  it('should apply destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('should apply secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-secondary')
  })

  it('should apply ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('border-transparent')
  })

  it('should apply default size', () => {
    render(<Button>Default Size</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-9')
  })

  it('should apply small size', () => {
    render(<Button size="sm">Small</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-8')
  })

  it('should apply large size', () => {
    render(<Button size="lg">Large</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-10')
  })

  it('should apply icon size', () => {
    render(<Button size="icon">🔍</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-9')
    expect(button).toHaveClass('w-9')
  })

  it('should handle click events', async () => {
    const user = userEvent.setup()
    let clicked = false

    render(
      <Button onClick={() => { clicked = true }}>
        Click me
      </Button>
    )

    const button = screen.getByRole('button')
    await user.click(button)

    expect(clicked).toBe(true)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should render as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/test')
    expect(link).toHaveTextContent('Link Button')
  })

  it('should accept custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null }
    render(<Button ref={ref as any}>Ref Button</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('should render with multiple variants and sizes', () => {
    const { rerender } = render(<Button variant="outline" size="sm">Test</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('min-h-8')

    rerender(<Button variant="destructive" size="lg">Test</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('min-h-10')
  })

  it('should not trigger click when disabled', async () => {
    const user = userEvent.setup()
    let clicked = false

    render(
      <Button disabled onClick={() => { clicked = true }}>
        Disabled Button
      </Button>
    )

    const button = screen.getByRole('button')
    await user.click(button)

    expect(clicked).toBe(false)
  })

  it('should support type attribute', () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
  })
})
