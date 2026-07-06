import re

# 1. Update admin.html
with open('frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add overlay
overlay = '<div class="sidebar-overlay" onclick="toggleSidebar()"></div>\n        <div class="sidebar">'
html = html.replace('<div class="sidebar">', overlay)

# Add onclick to nav items and IDs
nav_menu_regex = re.compile(r'<div class="nav-menu">(.*?)</div>', re.DOTALL)
nav_items_match = nav_menu_regex.search(html)
if nav_items_match:
    old_nav = nav_items_match.group(1)
    new_nav = old_nav.replace('href="#"', '')
    new_nav = re.sub(r'class="nav-item(.*?)".*?>(.*?)<', r'class="nav-item\1" onclick="switchAdminTab(this, \'view-\2\')" style="cursor:pointer;"><\2<', new_nav)
    # clean up the view ids (e.g., view- Dashboard -> view-dashboard)
    new_nav = re.sub(r'\'view-.*?<i class=".*?"></i>\s*(.*?)\'', lambda m: "'view-" + m.group(1).lower().replace(' ', '-').replace('(', '').replace(')', '') + "'", new_nav)
    html = html.replace(old_nav, new_nav)

# Wrap dashboard content
main_content_start = html.find('<!-- KPIs -->')
main_content_end = html.find('</div>\n    </div>\n    \n    <script src="js/admin.js"></script>')

dashboard_content = html[main_content_start:main_content_end]

wrapped_views = f"""
            <div id="view-dashboard" class="admin-view" style="display:block;">
                {dashboard_content}
            </div>
            
            <div id="view-merchants" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>All Merchants</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Phone</th>
                                <th>Login Status</th>
                                <th>Streak</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="fullMerchantsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="view-usage-analytics" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Usage Analytics</h2></div>
                <div style="background:white; padding: 24px; border-radius:16px; margin-bottom: 16px;">
                    <p style="color:#64748b;">Detailed charts and feature usage tracking (Coming Soon).</p>
                </div>
            </div>

            <div id="view-streaks" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Merchant Streaks & Rewards</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Current Streak</th>
                                <th>Highest Streak</th>
                                <th>Total Days</th>
                            </tr>
                        </thead>
                        <tbody id="streaksTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="view-transactions" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>All Transactions</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Txn ID</th>
                                <th>Merchant</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Source</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody id="transactionsTableBody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="view-bills-ocr" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>OCR Bills</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Bill ID</th>
                                <th>Merchant</th>
                                <th>Date</th>
                                <th>Total Amount</th>
                                <th>Image</th>
                            </tr>
                        </thead>
                        <tbody id="billsTableBody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="view-voice-commands" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Voice Commands</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Transcript</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody id="voiceTableBody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="view-inventory" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Global Inventory View</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Merchant</th>
                                <th>Item Name</th>
                                <th>Stock</th>
                                <th>Price</th>
                                <th>Category</th>
                            </tr>
                        </thead>
                        <tbody id="inventoryTableBody"></tbody>
                    </table>
                </div>
            </div>

            <div id="view-reports" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Reports</h2></div>
                <p style="color:#64748b;">Generate and download PDF/Excel reports.</p>
            </div>
            
            <div id="view-alerts" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>System Alerts</h2></div>
                <div class="table-card" style="overflow-x: auto;">
                    <table class="merchant-table">
                        <thead>
                            <tr>
                                <th>Alert</th>
                                <th>Merchant</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody id="alertsTableBody"></tbody>
                    </table>
                </div>
            </div>
            
            <div id="view-settings" class="admin-view" style="display:none;">
                <div class="tc-header" style="margin-top: 24px; margin-bottom: 16px;"><h2>Settings</h2></div>
                <div style="background:white; padding: 24px; border-radius:16px;">
                    <button class="nav-item" style="background:#ef4444; color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer;" onclick="logoutAdmin()">Logout (Admin)</button>
                </div>
            </div>
"""

html = html.replace(dashboard_content, wrapped_views)
with open('frontend/admin.html', 'w', encoding='utf-8') as f:
    f.write(html)


# 2. Update admin.css
with open('frontend/css/admin.css', 'r', encoding='utf-8') as f:
    css = f.read()

new_css = """
/* Overlay */
.sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 998;
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
}
.sidebar-overlay.show {
    display: block;
    opacity: 1;
}

/* Fix mobile scroll blocking */
.main-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}
"""
css += new_css

css = css.replace('.sidebar.open { left: 0; }', '.sidebar.open { left: 0; box-shadow: 2px 0 12px rgba(0,0,0,0.5); }')

with open('frontend/css/admin.css', 'w', encoding='utf-8') as f:
    f.write(css)


# 3. Update admin.js
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
"""

js = js.replace('function toggleSidebar() {\n    const sidebar = document.querySelector(\'.sidebar\');\n    sidebar.classList.toggle(\'open\');\n}', new_js)

with open('frontend/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("Updated admin frontend files")
