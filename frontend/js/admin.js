
const RENDER_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:10000' 
    : 'https://shopsathiai.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('merchant_role');
    const id = localStorage.getItem('merchant_id');
    
    if (role !== 'admin' || !id) {
        window.location.href = 'index.html';
        return;
    }
    
    // Default to Dashboard
    loadTabData('view-dashboard');
});

function logoutAdmin() {
    localStorage.clear();
    window.location.href = 'index.html';
}



let startX = 0;

document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
});

document.addEventListener('touchmove', e => {
    if (!document.querySelector('.sidebar').classList.contains('open')) return;
    let touchX = e.touches[0].clientX;
    if (startX - touchX > 50) {
        // Swipe left
        toggleSidebar();
        startX = 0;
    }
});

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 300);
    } else {
        sidebar.classList.add('open');
        overlay.style.display = 'block';
        setTimeout(() => overlay.classList.add('show'), 10);
    }
}

function switchAdminTab(element, viewId) {
    // UI Update
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    // View Update
    document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'none');
    const view = document.getElementById(viewId);
    if(view) view.style.display = 'block';
    
    // Title Update
    document.querySelector('.top-bar h1').innerText = element.innerText.trim();
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
    
    // Fetch data based on view
    loadTabData(viewId);
}

async function loadTabData(viewId) {
    if (viewId === 'view-dashboard') {
        loadDashboard();
    } else if (viewId === 'view-merchants') {
        fetchData('/api/admin/merchants', 'fullMerchantsTableBody', buildMerchantRow);
    } else if (viewId === 'view-streaks') {
        fetchData('/api/admin/streaks', 'streaksTableBody', buildStreakRow);
    } else if (viewId === 'view-transactions') {
        fetchData('/api/admin/transactions', 'transactionsTableBody', buildTxnRow);
    } else if (viewId === 'view-bills-ocr') {
        fetchData('/api/admin/bills', 'billsTableBody', buildBillRow);
    } else if (viewId === 'view-voice-commands') {
        fetchData('/api/admin/voice-commands', 'voiceTableBody', buildVoiceRow);
    } else if (viewId === 'view-inventory') {
        fetchData('/api/admin/inventory', 'inventoryTableBody', buildInventoryRow);
    } else if (viewId === 'view-alerts') {
        fetchData('/api/admin/alerts', 'alertsTableBody', buildAlertRow);
    }
}

async function fetchData(endpoint, tbodyId, rowBuilder) {
    try {
        const res = await fetch(`${RENDER_API_URL}${endpoint}`);
        const data = await res.json();
        if (data.status === 'SUCCESS') {
            const tbody = document.getElementById(tbodyId);
            if(tbody) {
                tbody.innerHTML = '';
                data.data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = rowBuilder(item);
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (e) {
        console.error("Error fetching", endpoint, e);
    }
}

function buildMerchantRow(m) {
    return `
        <td><div style="font-weight:600;">${m.shop_name}</div><div style="font-size:12px;color:#64748b;">${m.owner_name}</div></td>
        <td>${m.phone_number}</td>
        <td><span class="status-badge ${m.status === 'Active' ? 'active' : 'offline'}">${m.status}</span></td>
        <td>🔥 ${m.current_streak}</td>
        <td>${m.last_active ? new Date(m.last_active).toLocaleString() : 'Never'}</td>
        <td><a href="#" style="color:#0ea5e9;">View</a></td>
    `;
}

function buildStreakRow(m) {
    return `
        <td><div style="font-weight:600;">${m.shop_name}</div></td>
        <td><span style="color:#f97316; font-weight:700;">🔥 ${m.current_streak}</span></td>
        <td>${m.highest_streak}</td>
        <td>${m.total_login_days} Days</td>
    `;
}

function buildTxnRow(t) {
    return `
        <td style="font-size:12px; color:#64748b;">${t.transaction_id.substring(0,8)}</td>
        <td>${t.merchant_id.substring(0,8)}</td>
        <td><span style="color:${t.txn_type==='GOT' ? '#10b981' : '#ef4444'}; font-weight:600;">${t.txn_type}</span></td>
        <td style="font-weight:700;">₹${t.amount}</td>
        <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:11px;">${t.entry_source}</span></td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
    `;
}

function buildBillRow(b) {
    return `
        <td style="font-size:12px; color:#64748b;">${b.bill_id.substring(0,8)}</td>
        <td>${b.merchant_id.substring(0,8)}</td>
        <td>${b.bill_date}</td>
        <td style="font-weight:700;">₹${b.total_amount}</td>
        <td>${b.image_path ? `<a href="${b.image_path}" target="_blank" style="color:#0ea5e9;">View Bill</a>` : 'N/A'}</td>
    `;
}

function buildVoiceRow(v) {
    return `
        <td>${v.merchant_id.substring(0,8)}</td>
        <td><i>"${v.voice_transcript}"</i></td>
        <td><span style="color:#10b981;"><i class="ti ti-check"></i> Executed</span></td>
        <td>${new Date(v.created_at).toLocaleString()}</td>
    `;
}

function buildInventoryRow(i) {
    return `
        <td>${i.merchant_id.substring(0,8)}</td>
        <td style="font-weight:600;">${i.item_name}</td>
        <td><span style="color:${i.current_stock < i.reorder_level ? '#ef4444' : '#10b981'}; font-weight:700;">${i.current_stock}</span></td>
        <td>₹${i.price}</td>
        <td>${i.category || 'General'}</td>
    `;
}

function buildAlertRow(a) {
    return `
        <td><div style="font-weight:600; color:#ef4444;"><i class="ti ti-alert-triangle"></i> Low Stock Alert</div><div style="font-size:12px;">${a.item_name} is running low (${a.current_stock} left)</div></td>
        <td>${a.merchant_id.substring(0,8)}</td>
        <td>Real-time</td>
    `;
}


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
