with open('frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

new_js = """

let startX = 0;
document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
});
document.addEventListener('touchmove', e => {
    if (!document.querySelector('.sidebar').classList.contains('open')) return;
    let touchX = e.touches[0].clientX;
    if (startX - touchX > 50) {
        toggleSidebar();
        startX = 0;
    }
});

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

function switchAdminTab(element, viewId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';

    if (window.innerWidth <= 900) {
        toggleSidebar();
    }

    loadTabData(viewId);
}

function loadTabData(viewId) {
    if (viewId === 'view-dashboard') loadDashboard();
    else if (viewId === 'view-merchants') loadMerchantsView();
    else if (viewId === 'view-streaks') loadStreaksView();
    else if (viewId === 'view-transactions') loadTransactionsView();
    else if (viewId === 'view-bills-ocr') loadBillsView();
    else if (viewId === 'view-voice-commands') loadVoiceCommandsView();
    else if (viewId === 'view-inventory') loadInventoryView();
    else if (viewId === 'view-alerts') loadAlertsView();
}

async function loadMerchantsView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/dashboard`);
        const data = await res.json();
        const tbody = document.getElementById('fullMerchantsTableBody');
        tbody.innerHTML = '';
        if(data.merchants) {
            data.merchants.forEach(m => {
                tbody.innerHTML += `<tr>
                    <td>${m.shop_name}</td>
                    <td>${m.phone_number || 'N/A'}</td>
                    <td><span class="status-badge ${m.status === 'Active' ? 'active' : 'offline'}">${m.status}</span></td>
                    <td>🔥 ${m.current_streak}</td>
                    <td>${m.last_active ? new Date(m.last_active).toLocaleString() : 'N/A'}</td>
                    <td><button style="padding:4px 8px; border-radius:4px; border:1px solid #e2e8f0; background:white; cursor:pointer;">View</button></td>
                </tr>`;
            });
        }
    } catch(e) {}
}

async function loadStreaksView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/streaks`);
        const data = await res.json();
        const tbody = document.getElementById('streaksTableBody');
        tbody.innerHTML = '';
        data.forEach(m => {
            tbody.innerHTML += `<tr>
                <td>${m.shop_name}</td>
                <td>🔥 ${m.current_streak}</td>
                <td>${m.highest_streak}</td>
                <td>${m.total_days}</td>
            </tr>`;
        });
    } catch(e) {}
}

async function loadTransactionsView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/transactions`);
        const data = await res.json();
        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = '';
        data.forEach(t => {
            tbody.innerHTML += `<tr>
                <td>#${t.id}</td>
                <td>${t.merchant_id}</td>
                <td>${t.txn_type}</td>
                <td>₹${t.amount}</td>
                <td>${t.source}</td>
                <td>${new Date(t.timestamp).toLocaleString()}</td>
            </tr>`;
        });
    } catch(e) {}
}

async function loadBillsView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/bills`);
        const data = await res.json();
        const tbody = document.getElementById('billsTableBody');
        tbody.innerHTML = '';
        data.forEach(b => {
            tbody.innerHTML += `<tr>
                <td>#${b.id}</td>
                <td>${b.merchant_id}</td>
                <td>${new Date(b.timestamp).toLocaleString()}</td>
                <td>₹${b.total_amount || 0}</td>
                <td>${b.image_url ? `<a href="${b.image_url}" target="_blank">View Image</a>` : 'No Image'}</td>
            </tr>`;
        });
    } catch(e) {}
}

async function loadVoiceCommandsView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/voice-commands`);
        const data = await res.json();
        const tbody = document.getElementById('voiceTableBody');
        tbody.innerHTML = '';
        data.forEach(v => {
            tbody.innerHTML += `<tr>
                <td>${v.merchant_id}</td>
                <td>"${v.voice_transcript}"</td>
                <td><span style="color:#10b981;">Processed</span></td>
                <td>${new Date(v.timestamp).toLocaleString()}</td>
            </tr>`;
        });
    } catch(e) {}
}

async function loadInventoryView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/inventory`);
        const data = await res.json();
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        data.forEach(i => {
            tbody.innerHTML += `<tr>
                <td>${i.merchant_id}</td>
                <td>${i.item_name}</td>
                <td style="color:${i.stock_quantity < 5 ? '#ef4444' : '#10b981'}; font-weight:bold;">${i.stock_quantity} ${i.unit}</td>
                <td>₹${i.selling_price}</td>
                <td>${i.category}</td>
            </tr>`;
        });
    } catch(e) {}
}

async function loadAlertsView() {
    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/alerts`);
        const data = await res.json();
        const tbody = document.getElementById('alertsTableBody');
        tbody.innerHTML = '';
        data.forEach(a => {
            tbody.innerHTML += `<tr>
                <td style="color:#ef4444;"><i class="ti ti-alert-triangle"></i> Low Stock: ${a.item_name} (${a.stock_quantity} left)</td>
                <td>${a.merchant_id}</td>
                <td>${new Date().toLocaleString()}</td>
            </tr>`;
        });
    } catch(e) {}
}

"""

if "function switchAdminTab" not in js:
    # also remove existing toggleSidebar as we redefined it
    import re
    js = re.sub(r'function toggleSidebar\(\) \{[\s\S]*?\}', '', js)
    with open('frontend/js/admin.js', 'w', encoding='utf-8') as f:
        f.write(js + new_js)

