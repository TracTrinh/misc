export function mdToHtml(md) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Tách 1 hàng bảng: bỏ ô rỗng ở đầu/cuối (do dấu | biên) nhưng GIỮ ô rỗng giữa hàng.
  const splitRow = s => {
    const cells = s.split('|');
    if (cells.length && cells[0].trim() === '') cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    return cells;
  };
  const lines = md.replace(/\r/g,'').split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    let line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    // table
    if (/^\s*\|/.test(line) && /^\s*\|?[-\s|:]+\|?\s*$/.test(lines[i+1]||'')) {
      const head = splitRow(line);
      i += 2; let rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(splitRow(lines[i])); i++;
      }
      html += '<table><thead><tr>' + head.map(h=>`<th>${inline(h.trim())}</th>`).join('') +
              '</tr></thead><tbody>' +
              rows.map(r=>'<tr>'+r.map(c=>`<td>${inline(c.trim())}</td>`).join('')+'</tr>').join('') +
              '</tbody></table>';
      continue;
    }
    // heading
    let m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) { const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    // list — mỗi item có thể trải nhiều dòng: dòng thụt lề tiếp theo (không phải bullet mới)
    // được gộp vào chính <li> đó, ngăn cách bằng <br> để giữ xuống dòng.
    if (/^\s*-\s+/.test(line)) {
      let items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        let parts = [lines[i].replace(/^\s*-\s+/,'')]; i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*-\s+/.test(lines[i])) {
          parts.push(lines[i].trim()); i++;
        }
        items.push(parts.map(inline).join('<br>'));
      }
      html += '<ul>' + items.map(it=>`<li>${it}</li>`).join('') + '</ul>';
      continue;
    }
    // ordered list — mỗi item có thể trải nhiều dòng (giống unordered list ở trên):
    // dòng thụt lề tiếp theo (không phải item số mới) gộp vào chính <li> đó bằng <br>.
    if (/^\s*\d+\.\s+/.test(line)) {
      let items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let parts = [lines[i].replace(/^\s*\d+\.\s+/,'')]; i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
          parts.push(lines[i].trim()); i++;
        }
        items.push(parts.map(inline).join('<br>'));
      }
      html += '<ol>' + items.map(it=>`<li>${it}</li>`).join('') + '</ol>';
      continue;
    }
    // blockquote
    if (/^\s*>\s?/.test(line)) {
      let items = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { items.push(lines[i].replace(/^\s*>\s?/,'')); i++; }
      html += `<blockquote class="callout">${inline(items.join(' '))}</blockquote>`;
      continue;
    }
    // paragraph
    let para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*[#>\-|]/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    html += `<p>${inline(para.join(' '))}</p>`;
  }
  return html;
}
