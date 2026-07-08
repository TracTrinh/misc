import { icons } from './icons.js';
import { mdToHtml } from './md.js';
import { parseDrill, renderDrill, clearAllTimers } from './drills.js';

let MANIFEST = null;

async function init() {
  try {
    const res = await fetch('data/manifest.json');
    MANIFEST = await res.json();
    buildSidebar();
    setupNavToggle();
    setupSettings();
    window.addEventListener('hashchange', router);
    router();
  } catch (error) {
    document.body.innerHTML = '<h2 style="color:red; padding: 20px;">Lỗi tải cấu hình (manifest.json). Bạn nhớ dùng run.bat để chạy qua server chưa?</h2>';
  }
}

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = `
    <div class="nav-item">
      <a href="#/" class="nav-link">${icons.home} Home</a>
    </div>
    <div class="nav-item">
      <a href="#/notebook" class="nav-link">${icons.notebook} Sổ tay</a>
    </div>
  `;

  MANIFEST.learningPath.forEach(partId => {
    const part = MANIFEST.parts[partId];
    if (!part) return;
    
    const div = document.createElement('div');
    div.className = 'nav-item';
    div.innerHTML = `
      <div class="nav-link">${icons.book} ${part.title}</div>
      <div class="nav-sub">
        <a href="#/${partId}" class="nav-sub-link">Lý thuyết</a>
        <a href="#/${partId}/practice" class="nav-sub-link">Thực hành</a>
      </div>
    `;
    nav.appendChild(div);
  });
}

function setupNavToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('nav-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const settingsToggle = document.getElementById('settings-toggle');

  if (toggle && sidebar) {
    toggle.innerHTML = icons.menu;
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Bấm 1 mục điều hướng → gập menu lại (chỉ ảnh hưởng ở mobile)
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a.nav-link, a.nav-sub-link')) {
        sidebar.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (themeToggle) {
    const root = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (currentTheme === 'light') root.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = currentTheme === 'light' ? icons.moon : icons.sun;

    themeToggle.addEventListener('click', () => {
      const isLight = root.getAttribute('data-theme') === 'light';
      if (isLight) {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = icons.sun;
      } else {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = icons.moon;
      }
    });
  }

  if (settingsToggle) {
    settingsToggle.innerHTML = icons.settings;
  }
}

function setupSettings() {
  const modal = document.getElementById('settings-modal');
  const toggleBtn = document.getElementById('settings-toggle');
  const closeBtn = document.getElementById('settings-close');
  const cancelBtn = document.getElementById('settings-cancel');
  const saveBtn = document.getElementById('settings-save');
  const input = document.getElementById('api-key-input');

  const openModal = () => {
    input.value = localStorage.getItem('gemini_api_key') || '';
    modal.classList.add('show');
  };

  const closeModal = () => {
    modal.classList.remove('show');
  };

  const saveSettings = () => {
    const key = input.value.trim();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    closeModal();
  };

  if (toggleBtn) toggleBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  
  // Close on backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

async function router() {
  clearAllTimers();
  const hash = window.location.hash.slice(1) || '/';
  const contentArea = document.getElementById('content-area');
  
  document.querySelectorAll('.nav-sub-link, .nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`a[href="#${hash}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (hash === '/') {
    contentArea.innerHTML = `
      <div class="header-card">
        <h1 class="header-title">IELTS Speaking Trainer</h1>
        <p class="header-subtitle">Nền tảng luyện tập hệ thống theo phương pháp Story Engine & Thinking Engine.</p>
      </div>
      <div class="home-dashboard">
        ${MANIFEST.learningPath.map(p => {
          const part = MANIFEST.parts[p];
          return `
            <a href="#/${p}" class="dashboard-card">
              <h3>${part.title}</h3>
              <p style="color:var(--text-secondary); margin-top:0.5rem">${part.subtitle}</p>
            </a>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

  if (hash === '/notebook') {
    renderNotebook();
    return;
  }

  const parts = hash.split('/').filter(Boolean);
  const partId = parts[0];
  const action = parts[1]; // practice
  const drillId = parts[2]; // drill id

  const partData = MANIFEST.parts[partId];
  if (!partData) return;

  const headerHtml = `
    <div class="header-card">
      <h1 class="header-title">${partData.title}</h1>
      <p class="header-subtitle">${partData.subtitle}</p>
    </div>
    <div class="tabs">
      <a href="#/${partId}" class="tab ${!action ? 'active' : ''}">Lý thuyết</a>
      <a href="#/${partId}/practice" class="tab ${action === 'practice' ? 'active' : ''}">Thực hành</a>
    </div>
  `;

  if (!action) {
    // Theory
    contentArea.innerHTML = headerHtml + '<div id="theory-container" class="theory-content">Loading...</div>';
    try {
      const res = await fetch(partData.theory);
      if (!res.ok) throw new Error('Not found');
      const text = await res.text();
      document.getElementById('theory-container').innerHTML = mdToHtml(text);
    } catch (e) {
      document.getElementById('theory-container').innerHTML = `
        <div style="text-align:center; padding: 3rem 1rem; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
          <h3>Chưa có dữ liệu lý thuyết</h3>
          <p>Nội dung phần này đang được cập nhật, bạn quay lại sau nhé!</p>
        </div>
      `;
    }
  } else if (action === 'practice' && !drillId) {
    // Practice list
    contentArea.innerHTML = headerHtml + `
      <div class="drill-list">
        ${partData.drills.length ? partData.drills.map(d => `
          <a href="#/${partId}/practice/${d.id}" class="drill-item">
            <span class="drill-title">${d.title}</span>
            <span>&rarr;</span>
          </a>
        `).join('') : '<p style="color:var(--text-secondary)">Chưa có bài tập nào.</p>'}
      </div>
    `;
  } else if (action === 'practice' && drillId) {
    // Drill
    const drillIndex = partData.drills.findIndex(d => d.id === drillId);
    const drill = partData.drills[drillIndex];
    if (!drill) {
      contentArea.innerHTML = headerHtml + '<div class="drill-container"><p>Không tìm thấy bài tập.</p></div>';
      return;
    }

    const prevDrill = drillIndex > 0 ? partData.drills[drillIndex - 1] : null;
    const nextDrill = drillIndex < partData.drills.length - 1 ? partData.drills[drillIndex + 1] : null;

    let drillNavHtml = '<div style="display: flex; justify-content: space-between; margin: 1.5rem 0; max-width: 800px;">';
    if (prevDrill) {
      drillNavHtml += `<a href="#/${partId}/practice/${prevDrill.id}" class="btn" style="text-decoration: none;">&larr; ${prevDrill.title}</a>`;
    } else {
      drillNavHtml += `<div></div>`;
    }
    if (nextDrill) {
      drillNavHtml += `<a href="#/${partId}/practice/${nextDrill.id}" class="btn btn-primary" style="text-decoration: none;">${nextDrill.title} &rarr;</a>`;
    }
    drillNavHtml += '</div>';

    contentArea.innerHTML = headerHtml + drillNavHtml + '<div id="drill-container" class="drill-container">Loading...</div>' + drillNavHtml;

    try {
      const res = await fetch(drill.file);
      if (!res.ok) throw new Error('Not found');
      const text = await res.text();
      const drillData = parseDrill(text);
      renderDrill(document.getElementById('drill-container'), drillData);
    } catch (e) {
      document.getElementById('drill-container').innerHTML = `
        <div style="text-align:center; padding: 3rem 1rem; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔧</div>
          <h3>Lỗi tải dữ liệu bài tập</h3>
          <p>Bài tập này hiện chưa có sẵn hoặc bị lỗi. Bạn thử bài khác nhé!</p>
        </div>
      `;
    }
  }
}

window.deleteNotebookEntry = function(index) {
  let notebook = JSON.parse(localStorage.getItem('vocab_notebook') || '[]');
  notebook.splice(index, 1);
  localStorage.setItem('vocab_notebook', JSON.stringify(notebook));
  renderNotebook();
};

function renderNotebook() {
  const contentArea = document.getElementById('content-area');
  let notebook = JSON.parse(localStorage.getItem('vocab_notebook') || '[]');
  
  let html = `
    <div class="header-card">
      <h1 class="header-title">Sổ tay từ vựng</h1>
      <p class="header-subtitle">Ôn tập lại những từ vựng và câu trả lời hay mà AI đã gợi ý cho bạn.</p>
    </div>
  `;

  if (notebook.length === 0) {
    html += `
      <div style="text-align:center; padding: 3rem 1rem; color: var(--text-secondary);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📓</div>
        <h3>Sổ tay đang trống</h3>
        <p>Hãy làm bài tập và bấm "Lưu vào sổ tay" khi thấy AI gợi ý hay nhé!</p>
      </div>
    `;
  } else {
    html += `<div class="notebook-grid">`;
    notebook.forEach((item, index) => {
      const date = new Date(item.timestamp).toLocaleString('vi-VN');
      html += `
        <div class="notebook-card">
          <div style="display:flex; justify-content: space-between; align-items: flex-start;">
            <div class="notebook-date">${date} &bull; ${item.title ? '<strong>' + item.title + '</strong>' : ''}${item.layer ? ' &bull; Layer: ' + item.layer : ''}</div>
            <button class="btn btn-delete" onclick="window.deleteNotebookEntry(${index})">${icons.trash} Xóa</button>
          </div>
          <div class="notebook-question"><strong>Ngữ cảnh:</strong> ${item.question}</div>
          <div class="notebook-ai-answer">${mdToHtml(item.suggestion)}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  contentArea.innerHTML = html;
}

init();
