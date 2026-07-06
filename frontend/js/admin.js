
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
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
