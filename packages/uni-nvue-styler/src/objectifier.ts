import type { Container, Document, Root } from 'postcss'
import { extend, hasOwn } from '@vue/shared'
// import { COMBINATORS_RE } from './utils'
import parser from 'postcss-selector-parser'

interface ObjectifierContext {
  'FONT-FACE': Record<string, unknown>[]
  TRANSITION: Record<string, Record<string, unknown>>
}

export function objectifier(
  node: Root | Document | Container | null,
  { trim }: { trim: boolean } = { trim: false }
) {
  if (!node) {
    return {}
  }
  const context: ObjectifierContext = {
    'FONT-FACE': [],
    TRANSITION: {},
  }
  const result = transform(node, context)
  if (trim) {
    trimObj(result)
  }
  if (context['FONT-FACE'].length) {
    result['@FONT-FACE'] = context['FONT-FACE']
  }
  if (Object.keys(context.TRANSITION).length) {
    result['@TRANSITION'] = context.TRANSITION
  }
  return result
}

function trimObj(obj: Record<string, any>) {
  Object.keys(obj).forEach((name) => {
    const value = obj[name]
    if (Object.keys(value).length === 1 && hasOwn(value, '')) {
      obj[name] = value['']
    }
  })
}

function transform(
  node: Root | Document | Container,
  context: ObjectifierContext
) {
  const result: Record<string, Record<string, unknown> | unknown> = {}
  node.each((child) => {
    if (child.type === 'atrule') {
      const body = transform(child, context)
      const fontFamily = body.fontFamily as string
      if (fontFamily && '"\''.indexOf(fontFamily[0]) > -1) {
        body.fontFamily = fontFamily.slice(1, fontFamily.length - 1)
      }
      context['FONT-FACE'].push(body)
    } else if (child.type === 'rule') {
      const body = transform(child, context)
      child.selectors.forEach((selector) => {
        transformSelector(selector, body, result, context)
      })
    } else if (child.type === 'decl') {
      if (child.important) {
        result['!' + child.prop] = child.value
        // !important的值域优先级高，故删除非!important的值域
        delete result[child.prop]
      } else {
        if (!hasOwn(result, '!' + child.prop)) {
          result[child.prop] = child.value
        }
      }
    }
  })
  return result
}
const processer = parser()
function transformSelector(
  selector: string,
  body: Record<string, unknown>,
  result: Record<string, unknown | Record<string, unknown>>,
  context: ObjectifierContext
) {
  const ans = processer.astSync(selector)
  let sele = ans.nodes[0]
  const currSel = parser.selector({ value: '' })
  let lastCombinator = -1
  // 定位最后一个组合选择器
  for (let i = sele.nodes.length - 1; i >= 0; i--) {
    if (sele.nodes[i].type === 'combinator') {
      lastCombinator = i
      break
    }
  }
  // 添加组合选择器的下一个选择器
  currSel.append(sele.nodes.splice(lastCombinator + 1, 1) as any)
  if (
    sele.nodes[lastCombinator + 1] &&
    sele.nodes[lastCombinator + 1].type === 'pseudo'
  ) {
    // 添加伪类选择器
    currSel.append(sele.nodes.splice(lastCombinator + 1, 1) as any)
  }
  let parentSelector = ans.toString()
  // .a:checked => a:checked
  let curSelector = currSel.toString().substring(1)

  const pseudoIndex = curSelector.indexOf(':')
  if (pseudoIndex > -1) {
    const pseudoClass = curSelector.slice(pseudoIndex)
    curSelector = curSelector.slice(0, pseudoIndex)
    Object.keys(body).forEach(function (name) {
      body[name + pseudoClass] = body[name]
      delete body[name]
    })
  }
  transition(curSelector, body, context)
  if (!Object.keys(body).length) {
    return
  }
  result = (result[curSelector] || (result[curSelector] = {})) as Record<
    string,
    unknown
  >

  if (result[parentSelector]) {
    // clone
    result[parentSelector] = processImportant(
      extend({}, result[parentSelector], body)
    )
  } else {
    result[parentSelector] = body
  }
}

/**
 * 处理 important 属性，如果某个属性是 important，需要将非 important 的该属性移除掉
 * @param body
 */
function processImportant(body: Record<string, unknown>) {
  Object.keys(body).forEach((name) => {
    if (name.startsWith('!')) {
      delete body[name.substring(1)]
    }
  })
  return body
}

function transition(
  className: string,
  body: Record<string, unknown>,
  { TRANSITION }: ObjectifierContext
) {
  Object.keys(body).forEach((prop) => {
    if (prop.indexOf('transition') === 0 && prop !== 'transition') {
      const realProp = prop.replace('transition', '')
      TRANSITION[className] = TRANSITION[className] || {}
      TRANSITION[className][realProp[0].toLowerCase() + realProp.slice(1)] =
        body[prop]
    }
  })
}
