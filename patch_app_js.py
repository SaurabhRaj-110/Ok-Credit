import re

with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_bootApp = """        function bootApp() {
            if (MERCHANT_ROLE === 'admin') {
                window.location.href = 'admin.html';
            } else if (MERCHANT_ID) {
                // Logged in as merchant
                document.getElementById('splashLoginOverlay').style.display = 'none';
                initShopSathi();
                
                // Track login to update streak on reload
                fetch(`${RENDER_API_URL}/api/usage/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ merchant_id: MERCHANT_ID, action: 'login' })
                }).catch(e => console.error("Streak tracking error on load", e));
            } else {
                // Show login overlay
                document.getElementById('splashLoginOverlay').style.display = 'flex';
            }
        }"""

new_bootApp = """        function bootApp() {
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
        }"""

if old_bootApp in js:
    js = js.replace(old_bootApp, new_bootApp)
    print('bootApp replaced successfully.')
else:
    print('old_bootApp not found.')

init_end_str = """            renderUI();
            setTimeout(checkDueOrders, 1000);
        }"""

new_init_end_str = """            renderUI();
            setTimeout(checkDueOrders, 1000);
            
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
        }"""

if init_end_str in js:
    js = js.replace(init_end_str, new_init_end_str)
    print('fetch usage injected successfully.')
else:
    print('init_end_str not found.')

with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
    f.write(js)
