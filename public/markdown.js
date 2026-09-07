function appendHighlightedText(parent, text, highlight) {
  const needle = String(highlight || "").toLowerCase();
  if (!needle) {
    parent.append(document.createTextNode(text));
    return;
  }
  const source = text.toLowerCase();
  let offset = 0;
  while (offset < text.length) {
    const start = source.indexOf(needle, offset);
    if (start < 0) {
      parent.append(document.createTextNode(text.slice(offset)));
      break;
    }
    if (start > offset) parent.append(document.createTextNode(text.slice(offset, start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, start + needle.length);
    parent.append(mark);
    offset = start + needle.length;
  }
}

function safeLink(value) {
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function appendInline(parent, source, highlight = "") {
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|\[([^\]\n]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*/g;
  let offset = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > offset) {
      appendHighlightedText(parent, source.slice(offset, match.index), highlight);
    }
    let node;
    let content;
    if (match[1] !== undefined) {
      node = document.createElement("code");
      content = match[1];
    } else if (match[2] !== undefined) {
      node = document.createElement("strong");
      content = match[2];
    } else if (match[3] !== undefined) {
      node = document.createElement("del");
      content = match[3];
    } else if (match[4] !== undefined) {
      const href = safeLink(match[5]);
      node = document.createElement(href ? "a" : "span");
      if (href) {
        node.href = href;
        node.target = "_blank";
        node.rel = "noreferrer noopener";
      }
      content = match[4];
    } else {
      node = document.createElement("em");
      content = match[6];
    }
    if (node.tagName === "CODE") appendHighlightedText(node, content, highlight);
    else appendInline(node, content, highlight);
    parent.append(node);
    offset = match.index + match[0].length;
  }
  if (offset < source.length) appendHighlightedText(parent, source.slice(offset), highlight);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableDelimiter(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function startsBlock(lines, index) {
  const line = lines[index] || "";
  return /^\s*$/.test(line)
    || /^ {0,3}(?:```|~~~)/.test(line)
    || /^ {0,3}#{1,6}\s+/.test(line)
    || /^ {0,3}>\s?/.test(line)
    || /^\s*(?:[-+*]|\d+\.)\s+/.test(line)
    || /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    || (line.includes("|") && isTableDelimiter(lines[index + 1] || ""));
}

function renderBlocks(parent, source, highlight) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const fence = lines[index].match(/^ {0,3}(```+|~~~+)\s*([^\s]*)\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (fence[2]) code.dataset.language = fence[2].replace(/[^a-z0-9_+-]/gi, "").slice(0, 30);
      appendHighlightedText(code, codeLines.join("\n"), highlight);
      pre.append(code);
      parent.append(pre);
      continue;
    }

    const heading = lines[index].match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const node = document.createElement(`h${heading[1].length}`);
      appendInline(node, heading[2], highlight);
      parent.append(node);
      index += 1;
      continue;
    }

    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index])) {
      parent.append(document.createElement("hr"));
      index += 1;
      continue;
    }

    if (/^ {0,3}>\s?/.test(lines[index])) {
      const quoted = [];
      while (index < lines.length && /^ {0,3}>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^ {0,3}>\s?/, ""));
        index += 1;
      }
      const blockquote = document.createElement("blockquote");
      renderBlocks(blockquote, quoted.join("\n"), highlight);
      parent.append(blockquote);
      continue;
    }

    const listMatch = lines[index].match(/^\s*([-+*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const list = document.createElement(ordered ? "ol" : "ul");
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*([-+*]|\d+\.)\s+(.+)$/);
        if (!itemMatch || /\d+\./.test(itemMatch[1]) !== ordered) break;
        const item = document.createElement("li");
        const task = itemMatch[2].match(/^\[([ xX])\]\s+(.+)$/);
        if (task) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = task[1].toLowerCase() === "x";
          checkbox.disabled = true;
          checkbox.setAttribute("aria-hidden", "true");
          item.append(checkbox);
          appendInline(item, task[2], highlight);
        } else {
          appendInline(item, itemMatch[2], highlight);
        }
        list.append(item);
        index += 1;
      }
      parent.append(list);
      continue;
    }

    if (lines[index].includes("|") && isTableDelimiter(lines[index + 1] || "")) {
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const cellText of splitTableRow(lines[index])) {
        const cell = document.createElement("th");
        appendInline(cell, cellText, highlight);
        headRow.append(cell);
      }
      head.append(headRow);
      table.append(head);
      index += 2;
      const body = document.createElement("tbody");
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        const row = document.createElement("tr");
        for (const cellText of splitTableRow(lines[index])) {
          const cell = document.createElement("td");
          appendInline(cell, cellText, highlight);
          row.append(cell);
        }
        body.append(row);
        index += 1;
      }
      table.append(body);
      const wrap = document.createElement("div");
      wrap.className = "markdown-table-wrap";
      wrap.append(table);
      parent.append(wrap);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && (paragraphLines.length === 0 || !startsBlock(lines, index))) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = document.createElement("p");
    appendInline(paragraph, paragraphLines.join("\n"), highlight);
    parent.append(paragraph);
  }
}

export function renderMarkdown(container, source, { highlight = "", inlineOnly = false } = {}) {
  container.replaceChildren();
  container.classList.add(inlineOnly ? "markdown-inline" : "markdown-body");
  if (inlineOnly) appendInline(container, String(source || ""), highlight);
  else renderBlocks(container, source, highlight);
  return container;
}
