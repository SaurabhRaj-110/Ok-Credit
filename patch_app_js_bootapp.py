import re
with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_bootApp = """        function bootApp() {
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
            initShopSathi();"""

new_bootApp = """        function bootApp() {
            // Force login flow on new tab/window for demo purposes
            if (!sessionStorage.getItem('session_started')) {
                localStorage.removeItem('shopsathi_merchant_id');
                localStorage.removeItem('shopsathi_role');
                MERCHANT_ID = "";
                MERCHANT_ROLE = "";
                sessionStorage.setItem('session_started', 'true');
            }

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
            initShopSathi();"""

if old_bootApp in js:
    js = js.replace(old_bootApp, new_bootApp)
    with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print('bootApp updated successfully')
else:
    print('old_bootApp not found')
