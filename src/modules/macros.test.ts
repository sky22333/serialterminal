import { describe, expect, test, beforeEach } from 'vitest'

import { MAX_MACROS, createMacro, loadMacros, normalizeMacro, normalizeMacros, saveMacros } from './macros'

beforeEach(() => {
    window.localStorage.clear()
})

describe('normalizeMacro', () => {
    test('补齐默认值并保留内容', () => {
        const macro = normalizeMacro({ id: 'a', name: '查询版本', payload: 'AT+GMR', hex: true })

        expect(macro).toMatchObject({
            id: 'a',
            name: '查询版本',
            payload: 'AT+GMR',
            hex: true,
            appendLineEnding: true,
        })
    })

    test('没名字时按顺序补一个', () => {
        expect(normalizeMacro({ payload: 'x' }, 2).name).toBe('宏 3')
    })

    test('字段类型不对不会带进渲染', () => {
        const macro = normalizeMacro({ id: 5, name: 123, payload: { a: 1 }, hex: 'true' })

        expect(typeof macro.id).toBe('string')
        expect(macro.name).toBe('宏 1')
        expect(macro.payload).toBe('')
        expect(macro.hex).toBe(false)
    })

    test('超长名称和内容被截断', () => {
        const macro = normalizeMacro({ name: 'a'.repeat(100), payload: 'b'.repeat(5000) })

        expect(macro.name.length).toBeLessThanOrEqual(24)
        expect(macro.payload.length).toBeLessThanOrEqual(2048)
    })
})

describe('normalizeMacros', () => {
    test('非数组返回空列表', () => {
        expect(normalizeMacros(null)).toEqual([])
        expect(normalizeMacros({ a: 1 })).toEqual([])
    })

    test('数量有上限', () => {
        const list = normalizeMacros(Array.from({ length: MAX_MACROS + 5 }, () => ({ payload: 'x' })))
        expect(list).toHaveLength(MAX_MACROS)
    })
})

describe('loadMacros / saveMacros', () => {
    test('没有存储时返回空列表', () => {
        expect(loadMacros()).toEqual([])
    })

    test('保存后能读回来', () => {
        const saved = saveMacros([createMacro({ name: '重启', payload: 'reset' })])

        expect(saved).toHaveLength(1)
        expect(loadMacros()).toHaveLength(1)
        expect(loadMacros()[0].name).toBe('重启')
    })

    test('脏数据不会让界面崩', () => {
        window.localStorage.setItem('serialterminal.macros', '{坏掉的 JSON')

        expect(loadMacros()).toEqual([])
    })
})
