/**
 * Дашборд — клиентская логика
 */

// === NAV ===
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
    });
});

// === DATA ===
let allLeads = [];
let stats = {};

async function refreshData() {
    try {
        const [leadsRes, statsRes] = await Promise.all([
            fetch('/api/leads'),
            fetch('/api/stats'),
        ]);
        allLeads = await leadsRes.json();
        stats = await statsRes.json();

        renderStats();
        renderLeads();
        renderFunnel();
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

function renderStats() {
    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statHot').textContent = stats.byTemperature?.hot || 0;
    document.getElementById('statWarm').textContent = stats.byTemperature?.warm || 0;
    document.getElementById('statCold').textContent = stats.byTemperature?.cold || 0;
}

function renderLeads() {
    const tbody = document.getElementById('leadsBody');
    if (!allLeads.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Нет данных. Создайте тестовый лид на вкладке «Тест»</td></tr>';
        return;
    }

    tbody.innerHTML = allLeads.map(lead => {
        const statusLabels = {
            new: 'Новый', in_crm: 'В CRM', video_sent: 'Видео',
            kp_ready: 'КП готово', kp_sent: 'КП отправлено',
        };
        const services = (lead.serviceNames || lead.services || []).slice(0, 3).join(', ');
        const moreServices = (lead.serviceNames || lead.services || []).length > 3
            ? ` +${(lead.serviceNames || lead.services).length - 3}` : '';
        const date = new Date(lead.createdAt).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });

        return `<tr>
      <td><strong>${lead.name || '—'}</strong></td>
      <td>${services}${moreServices}</td>
      <td>${lead.area || '—'} м²</td>
      <td>${lead.budget ? lead.budget.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      <td><span class="badge badge-${lead.status}">${statusLabels[lead.status] || lead.status}</span></td>
      <td><span class="badge badge-${lead.temperature}">${lead.temperatureLabel || '—'}</span></td>
      <td>${date}</td>
      <td>${lead.pdfFile ? `<a href="/data/${lead.pdfFile}" target="_blank" style="color:var(--accent)">📄 Скачать</a>` : '—'}</td>
    </tr>`;
    }).join('');
}

function renderFunnel() {
    const total = stats.total || 1;
    const byStatus = stats.byStatus || {};

    const steps = [
        { id: 'funnelNew', count: total },
        { id: 'funnelCrm', count: (byStatus.in_crm || 0) + (byStatus.video_sent || 0) + (byStatus.kp_ready || 0) + (byStatus.kp_sent || 0) },
        { id: 'funnelVideo', count: (byStatus.video_sent || 0) + (byStatus.kp_ready || 0) + (byStatus.kp_sent || 0) },
        { id: 'funnelKp', count: (byStatus.kp_ready || 0) + (byStatus.kp_sent || 0) },
        { id: 'funnelSent', count: byStatus.kp_sent || 0 },
    ];

    steps.forEach(step => {
        const el = document.getElementById(step.id);
        const fill = el.querySelector('.funnel-fill');
        const countEl = el.querySelector('.funnel-count');
        const pct = total > 0 ? (step.count / total * 100) : 0;
        fill.style.width = `${Math.max(pct, 2)}%`;
        countEl.textContent = step.count;
    });
}

// === TEST LEAD ===
async function createTestLead() {
    const btn = document.getElementById('testBtn');
    const result = document.getElementById('testResult');

    btn.disabled = true;
    btn.textContent = '⏳ Создание...';
    result.className = 'test-result show loading';
    result.textContent = '🔄 Создаём тестовый лид и генерируем КП...';

    try {
        const res = await fetch('/api/demo/test-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const data = await res.json();

        if (data.success) {
            result.className = 'test-result show success';
            result.innerHTML = `✅ <strong>Готово!</strong><br>
        👤 ${data.lead.name}<br>
        📊 ${data.lead.temperatureLabel}<br>
        📄 <a href="/data/${data.pdf.filename}" target="_blank" style="color:#4ade80">Скачать КП</a><br>
        🆔 ${data.lead.id}`;
            refreshData();
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (err) {
        result.className = 'test-result show error';
        result.textContent = `❌ Ошибка: ${err.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Создать тестовый лид + КП';
    }
}

async function createCustomLead(e) {
    e.preventDefault();
    const result = document.getElementById('customResult');
    result.className = 'test-result show loading';
    result.textContent = '🔄 Обрабатывается...';

    const selected = [];
    document.querySelectorAll('.service-check.selected').forEach(el => {
        selected.push(el.dataset.id);
    });

    try {
        const res = await fetch('/api/demo/test-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('leadName').value,
                area: parseInt(document.getElementById('leadArea').value),
                budget: parseInt(document.getElementById('leadBudget').value),
                location: document.getElementById('leadLocation').value,
                phone: document.getElementById('leadPhone').value,
                services: selected.length > 0 ? selected : undefined,
            }),
        });
        const data = await res.json();

        if (data.success) {
            result.className = 'test-result show success';
            result.innerHTML = `✅ <strong>Лид создан!</strong><br>
        📄 <a href="/data/${data.pdf.filename}" target="_blank" style="color:#4ade80">Скачать КП</a>`;
            refreshData();
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        result.className = 'test-result show error';
        result.textContent = `❌ ${err.message}`;
    }
}

// === SERVICES CHECKBOXES ===
async function loadServices() {
    try {
        const res = await fetch('/api/services');
        const services = await res.json();
        const container = document.getElementById('servicesCheckboxes');
        container.innerHTML = services.map(s => `
      <label class="service-check" data-id="${s.id}" onclick="this.classList.toggle('selected')">
        <span>${s.icon} ${s.name}</span>
      </label>
    `).join('');
    } catch (err) {
        console.error(err);
    }
}

// === INIT ===
refreshData();
loadServices();
setInterval(refreshData, 5000); // auto-refresh every 5 sec
