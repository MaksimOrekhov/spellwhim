import { describe, expect, it } from 'vitest'
import { createRenderer, h, nextTick, reactive } from 'vue'
import MainMenu from './MainMenu.vue'
import { createSectorRun } from '../game/campaign'
import { honestDeck } from '../game/honestDecks'
import { defaultRulesMode } from '../game/rulesMode'
import { createRunSaveStore } from '../game/runSave'
import type { SaveStorage } from '../game/runSave'
import oldSave from '../game/fixtures/b2-long-mid-run-save.json?raw'

/** A bare-bones renderer instead of a browser: the real component is mounted, buttons are found by their text and their click handlers are called. */
interface Node { tag: string; props: Record<string, unknown>; children: Node[]; text?: string; parent: Node | null }
const node = (tag: string, text?: string): Node => ({ tag, props: {}, children: [], parent: null, ...(text === undefined ? {} : { text }) })
const { createApp } = createRenderer<Node, Node>({
  patchProp: (el, key, _previous, next) => { el.props[key] = next },
  insert: (child, parent, anchor) => {
    child.parent = parent
    const at = anchor ? parent.children.indexOf(anchor) : -1
    if (at < 0) parent.children.push(child); else parent.children.splice(at, 0, child)
  },
  remove: child => { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); child.parent = null },
  createElement: tag => node(tag),
  createText: text => node('#text', text),
  createComment: text => node('#comment', text),
  setText: (item, text) => { item.text = text },
  setElementText: (el, text) => { el.children = [Object.assign(node('#text', text), { parent: el })] },
  parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] ?? null,
})
const textOf = (item: Node): string => item.text ?? item.children.map(textOf).join('')
const all = (item: Node): Node[] => [item, ...item.children.flatMap(all)]

interface MenuState { saved: { active: boolean } | null; canReturn: boolean; notice: string; unreadable: boolean }
function mount(initial: Partial<MenuState> = {}) {
  const state = reactive<MenuState>({ saved: null, canReturn: false, notice: '', unreadable: false, ...initial })
  const events: string[] = []
  const root = node('root')
  createApp({ render: () => h(MainMenu, { ...state, onContinue: () => events.push('continue'), onReturn: () => events.push('return'), onNewRun: () => events.push('newRun'), onDownload: () => events.push('download'), onRetry: () => events.push('retry') }) }).mount(root)
  const labels = () => all(root).filter(item => item.tag === 'button').map(textOf)
  const alert = () => all(root).filter(item => item.props.role === 'alert').map(textOf).join(' ')
  async function click(label: string) {
    const button = all(root).find(item => item.tag === 'button' && textOf(item) === label)
    expect(button, `button "${label}" among ${labels().join(' | ')}`).toBeDefined()
    ;(button!.props.onClick as () => void)()
    await nextTick()
  }
  return { state, events, labels, alert, click }
}

describe('new run from the main menu', () => {
  it('starts at once when nothing is in the save slot', async () => {
    const menu = mount()
    expect(menu.labels()).toEqual(['Новый поход'])
    await menu.click('Новый поход')
    expect(menu.events).toEqual(['newRun'])
  })

  it('asks before it replaces a run that can be continued, and continuing does not ask', async () => {
    const menu = mount({ saved: { active: true } })
    expect(menu.labels()).toEqual(['Продолжить поход', 'Новый поход', 'Скачать копию'])
    await menu.click('Новый поход')
    expect(menu.events).toEqual([])
    expect(menu.labels()).toEqual(['Продолжить поход', 'Да, начать новый поход', 'Отмена', 'Скачать копию'])
    expect(menu.alert()).toContain('ещё можно продолжить')
    await menu.click('Отмена')
    expect(menu.events).toEqual([])
    await menu.click('Новый поход')
    await menu.click('Да, начать новый поход')
    expect(menu.events).toEqual(['newRun'])
    await menu.click('Продолжить поход')
    expect(menu.events).toEqual(['newRun', 'continue'])
  })

  it('asks before it replaces a finished run too', async () => {
    const menu = mount({ saved: { active: false } })
    expect(menu.labels()).toEqual(['Посмотреть итог', 'Новый поход', 'Скачать копию'])
    await menu.click('Новый поход')
    expect(menu.events).toEqual([])
    expect(menu.alert()).toContain('завершённый поход')
    await menu.click('Да, начать новый поход')
    expect(menu.events).toEqual(['newRun'])
  })

  it('asks before it replaces the run being played, which can be returned to', async () => {
    const menu = mount({ canReturn: true })
    expect(menu.labels()).toEqual(['Вернуться в поход', 'Новый поход'])
    await menu.click('Новый поход')
    expect(menu.events).toEqual([])
    expect(menu.alert()).toContain('заменит текущий')
    await menu.click('Да, начать новый поход')
    await menu.click('Вернуться в поход')
    expect(menu.events).toEqual(['newRun', 'return'])
  })

  it('lets an unreadable save be retried, copied out, or overwritten after an explicit warning', async () => {
    const menu = mount({ unreadable: true, notice: 'Не удалось прочитать сохранение. Данные оставлены в хранилище.' })
    expect(menu.labels()).toEqual(['Повторить загрузку', 'Новый поход', 'Скачать копию'])
    await menu.click('Скачать копию')
    await menu.click('Повторить загрузку')
    expect(menu.events).toEqual(['download', 'retry'])
    await menu.click('Новый поход')
    expect(menu.events).toEqual(['download', 'retry'])
    expect(menu.labels()).toEqual(['Повторить загрузку', 'Да, перезаписать сохранение', 'Отмена', 'Скачать копию'])
    expect(menu.alert()).toMatch(/перезапишет.*нельзя.*скачать копию/)
    await menu.click('Отмена')
    expect(menu.labels()).toEqual(['Повторить загрузку', 'Новый поход', 'Скачать копию'])
    expect(menu.events).toEqual(['download', 'retry'])
    await menu.click('Новый поход')
    await menu.click('Да, перезаписать сохранение')
    expect(menu.events).toEqual(['download', 'retry', 'newRun'])
  })

  it('forgets a question that no longer applies when the slot changes', async () => {
    const menu = mount({ unreadable: true })
    await menu.click('Новый поход')
    expect(menu.labels()).toContain('Да, перезаписать сохранение')
    menu.state.unreadable = false
    menu.state.saved = { active: true }
    await nextTick()
    expect(menu.labels()).toEqual(['Продолжить поход', 'Новый поход', 'Скачать копию'])
    expect(menu.alert()).toBe('')
  })
})

describe('the save slot behind the menu', () => {
  const memory = (initial: Record<string, string>): SaveStorage & { data: Record<string, string> } => {
    const data = { ...initial }
    return { data, getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value } }
  }
  const key = defaultRulesMode.saveKey
  const menuFor = (load: ReturnType<ReturnType<typeof createRunSaveStore>['load']>) => mount(load.snapshot ? { saved: { active: load.snapshot.run.status === 'active' } } : { unreadable: true, notice: load.message })

  it('a correct B2 Long save is still read and offered for continuing, and replacing it asks first', async () => {
    const store = createRunSaveStore(() => memory({ [key]: oldSave, [key + '.backup']: oldSave }), key)
    const loaded = store.load()
    expect(loaded.snapshot?.economy.id).toBe('honest-b2-long')
    expect(loaded.message).toBe('')
    const menu = menuFor(loaded)
    expect(menu.labels()[0]).toBe('Продолжить поход')
    await menu.click('Новый поход')
    expect(menu.events).toEqual([])
  })

  it('a damaged save leaves the menu able to start over, and the new run replaces the damaged records', async () => {
    const damaged = oldSave.slice(0, oldSave.length - 40)
    const storage = memory({ [key]: damaged, [key + '.backup']: damaged })
    const store = createRunSaveStore(() => storage, key)
    const loaded = store.load()
    expect(loaded.snapshot).toBeNull()
    expect(loaded.message).not.toBe('')
    expect(JSON.parse(store.exportSnapshot()).records).toHaveLength(2)
    const menu = menuFor(loaded)
    await menu.click('Новый поход')
    await menu.click('Да, перезаписать сохранение')
    expect(menu.events).toEqual(['newRun'])
    // what the app does on that event: write a fresh run into the slot
    const fresh = createSectorRun(5, defaultRulesMode.economy!, honestDeck('armor8', true), undefined, 'fresh')
    expect(store.save(fresh, defaultRulesMode.economy!).ok).toBe(true)
    const again = createRunSaveStore(() => storage, key).load()
    expect(again.message).toBe('')
    expect(again.snapshot?.run.runId).toBe('fresh')
  })

  it('a checksum mismatch is treated the same way', () => {
    const tampered = oldSave.replace(/"checksum":"[0-9a-f]+"/, '"checksum":"00000000"')
    expect(tampered).not.toBe(oldSave)
    const loaded = createRunSaveStore(() => memory({ [key]: tampered }), key).load()
    expect(loaded.snapshot).toBeNull()
    expect(loaded.message).not.toBe('')
  })
})
