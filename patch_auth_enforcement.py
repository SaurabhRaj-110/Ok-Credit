import re

# 1. Update app.js
with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Add logic to fetch usage data and update drawer Streak
usage_fetch_logic = """
            // Fetch usage data for drawer streak
            fetch(`${RENDER_API_URL}/api/usage/${MERCHANT_ID}`)
                .then(r => r.json())
                .then(data => {
                    if(data.status === 'SUCCESS' && data.data) {
                        const el = document.getElementById('drawerStreakDays');
                        if(el) el.innerText = `${data.data.current_streak} Days 🔥`;
                    }
                })
                .catch(e => console.error("Error fetching usage data", e));
"""

# Find initShopSathi and append this logic at the end of it, before the closing brace
init_shop_sathi_idx = app_js.find('function initShopSathi() {')
if init_shop_sathi_idx != -1:
    end_of_init = app_js.find('}', init_shop_sathi_idx)
    app_js = app_js[:end_of_init] + usage_fetch_logic + app_js[end_of_init:]

# Ensure login check is tight in bootApp
boot_app_regex = re.compile(r'function bootApp\(\) \{.*?(?=window\.addEventListener)', re.DOTALL)
boot_app_match = boot_app_regex.search(app_js)
if boot_app_match:
    old_boot_app = boot_app_match.group(0)
    new_boot_app = """function bootApp() {
            if (!MERCHANT_ID) {
                document.getElementById('splashLoginOverlay').style.display = 'flex';
                return;
            }
            if (MERCHANT_ROLE === 'admin') {
                window.location.href = 'admin.html';
                return;
            }
            
            // Logged in as merchant
            document.getElementById('splashLoginOverlay').style.display = 'none';
            initShopSathi();
            
            // Track login to update streak on reload
            fetch(`${RENDER_API_URL}/api/usage/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchant_id: MERCHANT_ID, action: 'login' })
            }).catch(e => console.error("Streak tracking error on load", e));
        }
        
        function logoutMerchant() {
            localStorage.clear();
            window.location.reload();
        }
        """
    app_js = app_js.replace(old_boot_app, new_boot_app)

# Link Logout button in Drawer menu
app_js = app_js.replace('<div class="drawer-menu-item" style="color: var(--red);">\n                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>\n                    <div class="dmi-text">Logout</div>', 
                        '<div class="drawer-menu-item" style="color: var(--red); cursor: pointer;" onclick="logoutMerchant()">\n                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>\n                    <div class="dmi-text">Logout</div>')

with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
    f.write(app_js)


# 2. Update admin.js
with open('frontend/js/admin.js', 'r', encoding='utf-8') as f:
    admin_js = f.read()

admin_auth_logic = """
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

"""
admin_js = admin_auth_logic + admin_js

with open('frontend/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(admin_js)

print("Updated app.js and admin.js with Auth Enforcement")
