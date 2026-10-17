import type { ObjectDirective } from 'vue'

interface FitTextState {
  observer: ResizeObserver
  animationFrame: number
  onWindowResize: () => void
}

const states = new WeakMap<HTMLElement, FitTextState>()

function fitText(element: HTMLElement) {
  const parent = element.parentElement
  if (!parent) return

  element.style.removeProperty('font-size')
  const style = getComputedStyle(element)
  const parentStyle = getComputedStyle(parent)
  const availableWidth = parent.clientWidth
    - Number.parseFloat(parentStyle.paddingLeft)
    - Number.parseFloat(parentStyle.paddingRight)
    - 4
  const maxSize = Number.parseFloat(style.fontSize)
  const minSize = Math.min(12, maxSize)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context || availableWidth <= 0 || !Number.isFinite(maxSize)) return

  const fontWeight = style.fontWeight === 'normal' ? '400' : style.fontWeight
  const fontFamily = style.fontFamily
  const text = element.textContent?.trim() ?? ''
  let size = maxSize

  while (size > minSize) {
    context.font = `${fontWeight} ${size}px ${fontFamily}`
    if (context.measureText(text).width <= availableWidth) break
    size = Math.max(minSize, size - 0.5)
  }

  element.style.fontSize = `${size}px`
}

function scheduleFit(element: HTMLElement, state: FitTextState) {
  if (states.get(element) !== state) return
  cancelAnimationFrame(state.animationFrame)
  state.animationFrame = requestAnimationFrame(() => fitText(element))
}

const vFitText: ObjectDirective<HTMLElement> = {
  mounted(element) {
    const parent = element.parentElement
    if (!parent) return

    const observer = new ResizeObserver(() => {
      const state = states.get(element)
      if (state) scheduleFit(element, state)
    })
    const onWindowResize = () => scheduleFit(element, state)
    const state: FitTextState = { observer, animationFrame: 0, onWindowResize }
    states.set(element, state)
    observer.observe(parent)
    window.addEventListener('resize', onWindowResize)
    void document.fonts?.ready.then(() => scheduleFit(element, state))
    scheduleFit(element, state)
  },
  updated(element) {
    const state = states.get(element)
    if (state) scheduleFit(element, state)
  },
  beforeUnmount(element) {
    const state = states.get(element)
    if (!state) return
    state.observer.disconnect()
    window.removeEventListener('resize', state.onWindowResize)
    cancelAnimationFrame(state.animationFrame)
    states.delete(element)
  },
}

export default vFitText
