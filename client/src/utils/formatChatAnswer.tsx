import type { ReactNode } from 'react'

function isQuoteWrapped(s: string): boolean {
  const t = s.trim()
  return (
    (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) ||
    (t.length >= 2 && t.startsWith("'") && t.endsWith("'"))
  )
}

type BoldMatch = { kind: 'bold'; start: number; end: number; content: string }
type ItalicMatch = { kind: 'italic'; start: number; end: number; content: string }
type InlineMatch = BoldMatch | ItalicMatch

function tryMatchBold(text: string, from: number): BoldMatch | null {
  if (text.startsWith('**', from)) {
    const close = text.indexOf('**', from + 2)
    if (close !== -1) {
      return {
        kind: 'bold',
        start: from,
        end: close + 2,
        content: text.slice(from + 2, close),
      }
    }
  }
  if (text.startsWith('__', from)) {
    const close = text.indexOf('__', from + 2)
    if (close !== -1) {
      return {
        kind: 'bold',
        start: from,
        end: close + 2,
        content: text.slice(from + 2, close),
      }
    }
  }
  return null
}

function tryMatchItalic(text: string, from: number): ItalicMatch | null {
  const opener = text[from]
  if (opener !== '*' && opener !== '_') return null
  if (text.startsWith('**', from) || text.startsWith('__', from)) return null

  let j = from + 1
  while (j < text.length) {
    if (text[j] !== opener) {
      j += 1
      continue
    }
    if (text.startsWith('**', j) || text.startsWith('__', j)) {
      j += 1
      continue
    }
    const content = text.slice(from + 1, j)
    if (!content.trim()) return null
    return { kind: 'italic', start: from, end: j + 1, content }
  }
  return null
}

function findNextInlineMatch(text: string, from: number): InlineMatch | null {
  let best: InlineMatch | null = null

  for (let i = from; i < text.length; i += 1) {
    const bold = tryMatchBold(text, i)
    const italic = tryMatchItalic(text, i)
    const candidate = [bold, italic]
      .filter((m): m is InlineMatch => m !== null)
      .sort((a, b) => a.start - b.start)[0]

    if (!candidate) continue
    if (!best || candidate.start < best.start) {
      best = candidate
      break
    }
  }

  return best
}

/** Render inline markdown: **bold**, __bold__, *italic*, _italic_ */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0
  let part = 0

  while (index < text.length) {
    const match = findNextInlineMatch(text, index)

    if (!match) {
      nodes.push(text.slice(index))
      break
    }

    if (match.start > index) {
      nodes.push(text.slice(index, match.start))
    }

    if (match.kind === 'bold') {
      nodes.push(
        <strong key={`${keyPrefix}-b-${part++}`}>
          {renderInline(match.content, `${keyPrefix}-b-${part}`)}
        </strong>,
      )
    } else if (isQuoteWrapped(match.content)) {
      nodes.push(match.content)
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i-${part++}`}>
          {renderInline(match.content, `${keyPrefix}-i-${part}`)}
        </em>,
      )
    }

    index = match.end
  }

  return nodes.length > 0 ? nodes : [text]
}

function isHorizontalRule(line: string): boolean {
  return /^(---|\*\*\*|___)\s*$/.test(line.trim())
}

function isHeading(line: string): RegExpMatchArray | null {
  return /^(#{1,6})\s+(.+)$/.exec(line.trim())
}

function headingClassName(level: number): string {
  switch (level) {
    case 1:
      return 'text-base font-semibold text-text mt-2 mb-1'
    case 2:
      return 'text-sm font-semibold text-text mt-2 mb-1'
    case 3:
      return 'text-sm font-medium text-text mt-2 mb-1'
    case 4:
      return 'text-sm font-medium text-text mt-1.5 mb-1'
    case 5:
      return 'text-xs font-medium text-text mt-1.5 mb-0.5'
    default:
      return 'text-xs font-medium text-text-muted mt-1 mb-0.5'
  }
}

function isBullet(line: string): RegExpMatchArray | null {
  return /^[-*]\s+(.+)$/.exec(line.trim())
}

function isNumbered(line: string): RegExpMatchArray | null {
  return /^\d+\.\s+(.+)$/.exec(line.trim())
}

function isFence(line: string): boolean {
  return /^```/.test(line.trim())
}

/** Separator row like |---|:---:|---| */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  const cells = parseTableRow(trimmed)
  if (cells.length === 0) return false
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  if (isTableSeparator(trimmed)) return false
  return parseTableRow(trimmed).length > 0
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|').map((cell) => cell.trim())
}

function looksLikeTableStart(lines: string[], index: number): boolean {
  if (!isTableRow(lines[index])) return false
  let j = index + 1
  while (j < lines.length && !lines[j].trim()) j += 1
  return j < lines.length && isTableSeparator(lines[j])
}

/**
 * Split compact / single-line Markdown tables into real lines so
 * header | separator | body can be detected. Never invent content—
 * only insert newlines around separator segments.
 */
function preprocessTableNewlines(content: string): string {
  // Before an embedded separator: "...| |---|---|" → "...|\n|---|---|"
  let result = content.replace(
    /\|\s+(\|(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?\|?)/g,
    '|\n$1',
  )

  // After a separator when the next data row starts: "|---| | Definition |" → "|---|\n| Definition |"
  result = result.replace(
    /((?:\|?\s*:?-{3,}:?\s*)+\|)\s+(\|(?!\s*:?-))/g,
    '$1\n$2',
  )

  return result
}

function renderTable(
  header: string[],
  body: string[][],
  key: string,
): ReactNode {
  return (
    <div key={key} className="my-2 overflow-x-auto">
      <table className="w-full min-w-[12rem] border-collapse text-sm text-text">
        <thead>
          <tr className="border-b border-border bg-background">
            {header.map((cell, idx) => (
              <th
                key={idx}
                className="px-2 py-1.5 text-left font-semibold align-top"
              >
                {renderInline(cell, `${key}-th-${idx}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border/60">
              {header.map((_, colIdx) => (
                <td key={colIdx} className="px-2 py-1.5 align-top">
                  {renderInline(row[colIdx] ?? '', `${key}-td-${rowIdx}-${colIdx}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Split cells from a glued multi-row line into rows of colCount. */
function splitGluedBodyCells(cells: string[], colCount: number): string[][] {
  if (colCount < 1) return cells.length ? [cells] : []
  if (cells.length <= colCount) return [cells]

  const rows: string[][] = []
  let current: string[] = []

  for (const cell of cells) {
    if (cell === '' && current.length === 0) continue
    if (cell === '' && current.length >= colCount) {
      rows.push(current.slice(0, colCount))
      current = []
      continue
    }
    current.push(cell)
    if (current.length === colCount) {
      rows.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    while (current.length < colCount) current.push('')
    rows.push(current.slice(0, colCount))
  }

  return rows
}

/**
 * Lightweight ChatGPT-like formatter for assistant answers.
 * Supports headings (#–######), bold, bullets, numbered lists,
 * paragraphs, code blocks, and Markdown tables.
 * Builds React nodes (no dangerouslySetInnerHTML).
 */
export function formatChatAnswer(content: string): ReactNode {
  if (!content?.trim()) return null

  const lines = preprocessTableNewlines(content.replace(/\r\n/g, '\n')).split(
    '\n',
  )
  const blocks: ReactNode[] = []
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    // Never show Markdown table separator rows as plain text
    if (isTableSeparator(line)) {
      i += 1
      continue
    }

    if (isHorizontalRule(line)) {
      blocks.push(
        <hr
          key={`hr-${blockKey++}`}
          className="my-3 border-0 border-t border-border"
        />,
      )
      i += 1
      continue
    }

    if (isFence(line)) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !isFence(lines[i])) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push(
        <pre
          key={`code-${blockKey++}`}
          className="my-2 overflow-x-auto rounded-lg bg-background border border-border px-3 py-2 text-xs font-mono text-text"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Markdown table: header row + separator, then body rows
    if (looksLikeTableStart(lines, i)) {
      const header = parseTableRow(lines[i])
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j += 1
      const separatorIndex = j
      j += 1

      const body: string[][] = []
      const colCount = header.length
      while (j < lines.length) {
        const nextTrim = lines[j].trim()
        if (!nextTrim) break
        if (isTableSeparator(lines[j])) {
          j += 1
          continue
        }
        if (!isTableRow(lines[j])) break
        const cells = parseTableRow(lines[j])
        if (colCount > 0 && cells.length > colCount + 1) {
          body.push(...splitGluedBodyCells(cells, colCount))
        } else {
          body.push(cells)
        }
        j += 1
      }

      if (colCount === 0) {
        // Malformed header: fall back to plain text (never include separator lines)
        const fallbackLines = lines
          .slice(i, j)
          .map((l) => l.trim())
          .filter((l) => l && !isTableSeparator(l))
        blocks.push(
          <p
            key={`p-${blockKey++}`}
            className="my-1.5 text-sm text-text leading-relaxed"
          >
            {renderInline(fallbackLines.join(' '), `p-${blockKey}`)}
          </p>,
        )
      } else {
        const normalizedBody = body.map((row) => {
          const cells = [...row]
          while (cells.length < colCount) cells.push('')
          return cells.slice(0, colCount)
        })
        blocks.push(
          renderTable(header, normalizedBody, `table-${blockKey++}`),
        )
      }

      // Always skip past separator even if no body rows
      i = Math.max(j, separatorIndex + 1)
      continue
    }

    const heading = isHeading(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      blocks.push(
        <p key={`h-${blockKey++}`} className={headingClassName(level)}>
          {renderInline(text, `h-${blockKey}`)}
        </p>,
      )
      i += 1
      continue
    }

    if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const bullet = isBullet(lines[i])
        if (!bullet) break
        items.push(bullet[1])
        i += 1
      }
      blocks.push(
        <ul
          key={`ul-${blockKey++}`}
          className="my-2 list-disc space-y-1 pl-5 text-sm text-text"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ul-${blockKey}-${idx}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (isNumbered(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const numbered = isNumbered(lines[i])
        if (!numbered) break
        items.push(numbered[1])
        i += 1
      }
      blocks.push(
        <ol
          key={`ol-${blockKey++}`}
          className="my-2 list-decimal space-y-1 pl-5 text-sm text-text"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ol-${blockKey}-${idx}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    const paraLines: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i]
      const nextTrim = next.trim()
      if (
        !nextTrim ||
        isHorizontalRule(next) ||
        isFence(next) ||
        isHeading(next) ||
        isBullet(next) ||
        isNumbered(next) ||
        isTableSeparator(next) ||
        looksLikeTableStart(lines, i)
      ) {
        break
      }
      paraLines.push(nextTrim)
      i += 1
    }

    blocks.push(
      <p key={`p-${blockKey++}`} className="my-1.5 text-sm text-text leading-relaxed">
        {renderInline(paraLines.join(' '), `p-${blockKey}`)}
      </p>,
    )
  }

  return <div className="space-y-0.5">{blocks}</div>
}
