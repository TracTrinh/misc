import { mdToHtml } from './md.js';
import { icons } from './icons.js';

let activeTimers = [];
export function clearAllTimers() {
  activeTimers.forEach(clearInterval);
  activeTimers = [];
}

export function parseDrill(text) {
  const blocks = text.replace(/\r/g,'').split(/^\s*---\s*$/m);
  const parse = b => {
    const o = {};
    b.split('\n').forEach(l => {
      if (/^\s*#/.test(l) || /^\s*$/.test(l)) return;
      const m = l.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
      if (m) o[m[1]] = m[2].trim();
    });
    return o;
  };
  const meta = parse(blocks[0]);
  const items = blocks.slice(1).map(parse).filter(o => Object.keys(o).length);
  return { meta, items };
}

export function renderDrill(container, drillData) {
  const { meta, items } = drillData;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `
    <h2>${meta.title || 'Practice Drill'}</h2>
    <p class="drill-intro">${meta.intro || ''}</p>
    <div class="drill-controls">
      <button class="btn" id="btn-shuffle">${icons.shuffle} Trộn thứ tự</button>
      <button class="btn" id="btn-reset">${icons.refresh} Làm lại</button>
      ${['sort', 'identify', 'classify_qtype'].includes(meta.type) ? `<button class="btn btn-primary" id="btn-check">${icons.check} Kiểm tra</button>` : ''}
    </div>
    <div class="drill-progress"><div class="drill-progress-bar" id="drill-progress-bar"></div></div>
    <div class="drill-progress-text" id="drill-progress-text"></div>
    <div class="drill-result" id="drill-result" role="status" aria-live="polite"></div>
  `;
  container.appendChild(header);

  const progressBar = header.querySelector('#drill-progress-bar');
  const progressText = header.querySelector('#drill-progress-text');
  const resultBox = header.querySelector('#drill-result');

  const itemsContainer = document.createElement('div');
  itemsContainer.id = 'items-container';
  container.appendChild(itemsContainer);

  let currentItems = [...items];

  const updateProgress = () => {
    const total = currentItems.length;
    const blocks = itemsContainer.querySelectorAll('.drill-block');
    let done = 0;
    blocks.forEach(b => {
      if (['sort', 'identify', 'classify_qtype'].includes(meta.type) && b.dataset.selected) done++;
      else if (['expand', 'build', 'timer'].includes(meta.type) && b.dataset.done === '1') done++;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressText.textContent = `${done} / ${total}`;
  };

  const renderItems = () => {
    clearAllTimers();
    itemsContainer.innerHTML = '';
    resultBox.classList.remove('show');
    resultBox.innerHTML = '';
    currentItems.forEach((item, index) => {
      const block = document.createElement('div');
      block.className = 'drill-block';
      block.dataset.index = index;

      if (meta.type === 'sort') {
        const buckets = meta.buckets.split('|').map(s => s.trim());
        block.innerHTML = `
          <div class="sentence">${item.sentence}</div>
          <div class="options">
            ${buckets.map(b => `<button class="option-btn bucket-${b}" data-bucket="${b}">${b}</button>`).join('')}
          </div>
          <div class="feedback">Đáp án: ${item.answer}</div>
        `;
        const btns = block.querySelectorAll('.option-btn');
        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            block.dataset.selected = btn.dataset.bucket;
            updateProgress();
          });
        });
      } else if (meta.type === 'identify' || meta.type === 'classify_qtype') {
        const isIdentify = meta.type === 'identify';
        const labels = isIdentify ? meta.labels : meta.types;
        const bucketArr = labels.split('|').map(s => s.trim());
        
        block.innerHTML = `
          <div class="sentence">${item.question}</div>
          ${isIdentify && item.answer_text ? `<div class="answer-text">${item.answer_text}</div>` : ''}
          <div class="options">
            ${bucketArr.map(b => `<button class="option-btn bucket-${b.replace(/\W/g, '')}" data-bucket="${b}">${b}</button>`).join('')}
          </div>
          <div class="feedback">Đáp án: ${item.answer}</div>
          ${isIdentify && item.explain ? `<div class="explain">Giải thích: ${item.explain}</div>` : ''}
        `;
        
        const btns = block.querySelectorAll('.option-btn');
        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            block.dataset.selected = btn.dataset.bucket;
            updateProgress();
          });
        });
      } else if (meta.type === 'expand') {
        block.innerHTML = `
          <div class="sentence">${item.prompt}</div>
          <p style="color:var(--text-secondary); margin-bottom:1rem; font-size: 0.95rem;">Gợi ý: ${item.hint}</p>
          <textarea class="textarea-expand" placeholder="Viết câu trả lời của bạn vào đây..."></textarea>
          <div class="options">
             <button class="btn btn-toggle-model">Xem model answer</button>
             <button class="btn btn-mark" data-mark="pass">${icons.check} Đạt</button>
             <button class="btn btn-mark" data-mark="revise">${icons.refresh} Cần sửa</button>
             <button class="btn feature-locked" disabled>${icons.mic} Ghi âm & chấm (sắp có)</button>
          </div>
          <div class="model-answer">${mdToHtml(item.model || '')}</div>
        `;
        const toggleBtn = block.querySelector('.btn-toggle-model');
        const model = block.querySelector('.model-answer');
        toggleBtn.addEventListener('click', () => {
          const shown = model.style.display === 'block';
          model.style.display = shown ? 'none' : 'block';
          toggleBtn.textContent = shown ? 'Xem model answer' : 'Ẩn model answer';
        });
        block.querySelectorAll('.btn-mark').forEach(btn => {
          btn.addEventListener('click', () => {
            block.classList.remove('marked-pass', 'marked-revise');
            block.classList.add(btn.dataset.mark === 'pass' ? 'marked-pass' : 'marked-revise');
            block.dataset.done = '1';
            updateProgress();
          });
        });
      } else if (meta.type === 'build') {
        const layers = meta.layers.split('|').map(s => s.trim());
        let html = `<div class="sentence">${item.question}</div><div class="build-layers">`;
        layers.forEach(layer => {
          html += `
            <div class="build-layer" style="margin-bottom: 1rem;">
              <div class="layer-label" style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">${layer}</div>
              <textarea class="textarea-expand" placeholder="Viết ý ${layer}..."></textarea>
              <div class="model-answer" data-layer="${layer}">${mdToHtml(item['model_' + layer] || '')}</div>
            </div>
          `;
        });
        html += `</div>
          <div class="options">
             <button class="btn btn-toggle-model">Xem gợi ý</button>
             <button class="btn btn-mark" data-mark="pass">${icons.check} Đạt</button>
             <button class="btn btn-mark" data-mark="revise">${icons.refresh} Cần sửa</button>
             <button class="btn feature-locked" disabled>${icons.mic} Ghi âm & chấm (sắp có)</button>
          </div>
        `;
        block.innerHTML = html;
        const toggleBtn = block.querySelector('.btn-toggle-model');
        const models = block.querySelectorAll('.model-answer');
        toggleBtn.addEventListener('click', () => {
          const shown = models[0].style.display === 'block';
          models.forEach(m => m.style.display = shown ? 'none' : 'block');
          toggleBtn.textContent = shown ? 'Xem gợi ý' : 'Ẩn gợi ý';
        });
        block.querySelectorAll('.btn-mark').forEach(btn => {
          btn.addEventListener('click', () => {
            block.classList.remove('marked-pass', 'marked-revise');
            block.classList.add(btn.dataset.mark === 'pass' ? 'marked-pass' : 'marked-revise');
            block.dataset.done = '1';
            updateProgress();
          });
        });
      } else if (meta.type === 'timer') {
        const prepTime = parseInt(meta.prep, 10) || 60;
        const talkTime = parseInt(meta.talk, 10) || 120;
        
        block.innerHTML = `
          <div class="sentence">${item.question}</div>
          <div class="timer-display" style="font-size: 2.5rem; font-weight: bold; margin: 1.5rem 0; text-align: center; font-family: monospace;">
            <span class="timer-label" style="display: block; font-size: 1rem; color: var(--text-secondary); font-family: var(--font-family, system-ui, sans-serif); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Sẵn sàng</span>
            <span class="timer-time">00:00</span>
          </div>
          <div class="options" style="justify-content: center; gap: 1rem;">
             <button class="btn btn-primary btn-timer-start">${icons.play} Bắt đầu</button>
             <button class="btn btn-timer-stop" style="display: none;">${icons.pause} Dừng</button>
             <button class="btn feature-locked" disabled>${icons.mic} Ghi âm & chấm (sắp có)</button>
          </div>
        `;
        
        const startBtn = block.querySelector('.btn-timer-start');
        const stopBtn = block.querySelector('.btn-timer-stop');
        const timeDisplay = block.querySelector('.timer-time');
        const labelDisplay = block.querySelector('.timer-label');
        let timerId = null;

        const formatTime = (secs) => {
          const m = Math.floor(secs / 60).toString().padStart(2, '0');
          const s = (secs % 60).toString().padStart(2, '0');
          return `${m}:${s}`;
        };

        const stopTimer = () => {
          if (timerId) {
            clearInterval(timerId);
            const idx = activeTimers.indexOf(timerId);
            if (idx > -1) activeTimers.splice(idx, 1);
          }
          startBtn.style.display = 'inline-flex';
          stopBtn.style.display = 'none';
          labelDisplay.textContent = 'Đã dừng';
          timeDisplay.style.color = 'var(--text-primary)';
        };

        const startPhase = (duration, labelText, color, onComplete) => {
          labelDisplay.textContent = labelText;
          timeDisplay.style.color = color;
          let remaining = duration;
          timeDisplay.textContent = formatTime(remaining);
          
          timerId = setInterval(() => {
            remaining--;
            timeDisplay.textContent = formatTime(remaining);
            if (remaining <= 0) {
              clearInterval(timerId);
              const idx = activeTimers.indexOf(timerId);
              if (idx > -1) activeTimers.splice(idx, 1);
              if (onComplete) onComplete();
            }
          }, 1000);
          activeTimers.push(timerId);
        };

        startBtn.addEventListener('click', () => {
          if (timerId) {
            clearInterval(timerId);
            const idx = activeTimers.indexOf(timerId);
            if (idx > -1) activeTimers.splice(idx, 1);
          }
          startBtn.style.display = 'none';
          stopBtn.style.display = 'inline-flex';
          
          startPhase(prepTime, 'Chuẩn bị (Preparation)', 'var(--color-value, orange)', () => {
            startPhase(talkTime, 'Nói (Speaking)', 'var(--color-success, green)', () => {
              stopBtn.style.display = 'none';
              startBtn.style.display = 'inline-flex';
              labelDisplay.textContent = 'Hoàn thành';
              timeDisplay.style.color = 'var(--text-primary)';
              block.dataset.done = '1';
              updateProgress();
            });
          });
        });

        stopBtn.addEventListener('click', stopTimer);
      }

      itemsContainer.appendChild(block);
    });
    updateProgress();
  };

  renderItems();

  container.querySelector('#btn-shuffle').addEventListener('click', () => {
    for (let i = currentItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentItems[i], currentItems[j]] = [currentItems[j], currentItems[i]];
    }
    renderItems();
  });

  container.querySelector('#btn-reset').addEventListener('click', () => {
    currentItems = [...items];
    renderItems();
  });

  const checkBtn = container.querySelector('#btn-check');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const blocks = itemsContainer.querySelectorAll('.drill-block');
      let score = 0, unanswered = 0;
      blocks.forEach(block => {
        block.classList.remove('correct', 'incorrect');
        const idx = block.dataset.index;
        const selected = block.dataset.selected;
        const correct = currentItems[idx].answer;
        if (!selected) { unanswered++; return; }

        if (selected.trim().toLowerCase() === correct.trim().toLowerCase()) {
          block.classList.add('correct');
          score++;
        } else {
          block.classList.add('incorrect');
        }
      });
      let msg = `Điểm: ${score} / ${currentItems.length}`;
      if (unanswered) msg += ` <span class="muted">· còn ${unanswered} câu chưa chọn</span>`;
      resultBox.innerHTML = msg;
      resultBox.classList.add('show');
    });
  }
}
