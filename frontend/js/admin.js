


const RENDER_API_URL = ''; // using relative or setup via env

function logoutAdmin() {
    localStorage.clear();
    window.location.href = 'index.html';
}

async function loadDashboard() {
    // Check Auth
    if (localStorage.getItem('shopsathi_role') !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set Date
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('en-GB', dateOptions);

    try {
        const res = await fetch(`${RENDER_API_URL}/api/admin/dashboard`);
        const data = await res.json();
        if (data.status === 'SUCCESS') {
            const ov = data.overview;
            
            document.getElementById('kpiTotalMerchants').innerText = ov.total_merchants;
            document.getElementById('kpiActiveToday').innerText = ov.today_active;
            document.getElementById('kpiOnline').innerText = ov.current_online;
            document.getElementById('currentOnlineCount').innerText = ov.current_online;
            document.getElementById('kpiAvgStreak').innerText = ov.avg_streak + " Days";
            document.getElementById('kpiTxn').innerText = ov.total_transactions.toLocaleString();
            document.getElementById('kpiOcr').innerText = ov.total_ocr.toLocaleString();
            document.getElementById('kpiVoice').innerText = ov.total_voice.toLocaleString();
            
            // Build Table
            const tbody = document.getElementById('merchantTableBody');
            tbody.innerHTML = '';
            
            data.merchants.forEach((m, idx) => {
                const tr = document.createElement('tr');
                const adoptionVoice = Math.min(100, (m.voice_commands / (m.total_sessions || 1)) * 30).toFixed(0);
                const adoptionOcr = Math.min(100, (m.ocr_scans / (m.total_sessions || 1)) * 20).toFixed(0);
                
                tr.innerHTML = `
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="color:#94a3b8; font-size:12px;">${idx + 1}</span>
                            <span>${m.shop_name} <i class="ti ti-discount-check-filled" style="color:#10b981;"></i></span>
                        </div>
                    </td>
                    <td><span style="color:#f97316;">🔥 ${m.current_streak} Days</span></td>
                    <td>${m.highest_streak} Days</td>
                    <td style="color:#64748b; font-size:13px;">${m.last_active ? new Date(m.last_active).toLocaleString() : 'N/A'}</td>
                    <td>${m.total_sessions}</td>
                    <td>${m.txn_count}</td>
                    <td><span class="status-badge ${m.status === 'Active' ? 'active' : 'offline'}">${m.status}</span></td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap:4px; font-size:11px; color:#64748b;">
                            <div style="display:flex; justify-content:space-between;"><span>Voice AI:</span> <span style="font-weight:700; color:#0f172a;">${adoptionVoice}%</span></div>
                            <div style="display:flex; justify-content:space-between;"><span>KhataSnap:</span> <span style="font-weight:700; color:#0f172a;">${adoptionOcr}%</span></div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            renderCharts();
        }
    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
}

function renderCharts() {
    const ctxDam = document.getElementById('damChart').getContext('2d');
    new Chart(ctxDam, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Active Merchants',
                data: [7, 6, 9, 15, 13, 11, 8],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
        }
    });

    const ctxRet = document.getElementById('retentionChart').getContext('2d');
    new Chart(ctxRet, {
        type: 'bar',
        data: {
            labels: ['Day 1', 'Day 3', 'Day 7', 'Day 14', 'Day 30'],
            datasets: [{
                label: 'Retention %',
                data: [100, 88, 71, 59, 42],
                backgroundColor: '#10b981',
                borderRadius: 4,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { callback: function(v) { return v + '%' } }, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
    
    // Tiny sidebar chart
    const ctxLive = document.getElementById('liveChart').getContext('2d');
    new Chart(ctxLive, {
        type: 'line',
        data: {
            labels: ['1','2','3','4','5','6','7'],
            datasets: [{
                data: [1, 2, 1, 3, 2, 4, 3],
                borderColor: '#8b5cf6',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false }, x: { display: false } }
        }
    });
}

document.addEventListener('DOMContentLoaded', loadDashboard);


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

