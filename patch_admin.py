with open('frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Overlay
html = html.replace('<!-- Sidebar -->\n        <div class="sidebar">', '<div class="sidebar-overlay" onclick="toggleSidebar()"></div>\n        <!-- Sidebar -->\n        <div class="sidebar">')

# 2. Nav Menu
old_nav = '''            <div class="nav-menu">
                <a href="#" class="nav-item active"><i class="ti ti-layout-dashboard"></i> Dashboard</a>
                <a href="#" class="nav-item"><i class="ti ti-users"></i> Merchants</a>
                <a href="#" class="nav-item"><i class="ti ti-chart-bar"></i> Usage Analytics</a>
                <a href="#" class="nav-item"><i class="ti ti-flame"></i> Streaks</a>
                <a href="#" class="nav-item"><i class="ti ti-receipt"></i> Transactions</a>
                <a href="#" class="nav-item"><i class="ti ti-scan"></i> Bills (OCR)</a>
                <a href="#" class="nav-item"><i class="ti ti-microphone"></i> Voice Commands</a>
                <a href="#" class="nav-item"><i class="ti ti-box"></i> Inventory</a>
                <a href="#" class="nav-item"><i class="ti ti-file-analytics"></i> Reports</a>
                <a href="#" class="nav-item"><i class="ti ti-bell"></i> Alerts</a>
                <a href="#" class="nav-item"><i class="ti ti-settings"></i> Settings</a>
            </div>'''
new_nav = '''            <div class="nav-menu">
                <a class="nav-item active" onclick="switchAdminTab(this, 'view-dashboard')" style="cursor:pointer;"><i class="ti ti-layout-dashboard"></i> Dashboard</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-merchants')" style="cursor:pointer;"><i class="ti ti-users"></i> Merchants</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-usage-analytics')" style="cursor:pointer;"><i class="ti ti-chart-bar"></i> Usage Analytics</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-streaks')" style="cursor:pointer;"><i class="ti ti-flame"></i> Streaks</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-transactions')" style="cursor:pointer;"><i class="ti ti-receipt"></i> Transactions</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-bills-ocr')" style="cursor:pointer;"><i class="ti ti-scan"></i> Bills (OCR)</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-voice-commands')" style="cursor:pointer;"><i class="ti ti-microphone"></i> Voice Commands</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-inventory')" style="cursor:pointer;"><i class="ti ti-box"></i> Inventory</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-reports')" style="cursor:pointer;"><i class="ti ti-file-analytics"></i> Reports</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-alerts')" style="cursor:pointer;"><i class="ti ti-bell"></i> Alerts</a>
                <a class="nav-item" onclick="switchAdminTab(this, 'view-settings')" style="cursor:pointer;"><i class="ti ti-settings"></i> Settings</a>
            </div>'''
html = html.replace(old_nav, new_nav)

# 3. Wrapping views
start_kpis = html.find('<!-- KPIs -->')
end_main = html.find('        </div>\n    </div>')

dashboard_html = html[start_kpis:end_main]

new_views = '''            <div id="view-dashboard" class="admin-view" style="display:block;">
''' + dashboard_html + '''            </div>
            
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
'''
html = html[:start_kpis] + new_views + html[end_main:]

with open('frontend/admin.html', 'w', encoding='utf-8') as f:
    f.write(html)
