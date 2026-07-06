import re

with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

init_end_str = """            // Setup periodic polling for notifications
            setInterval(fetchNotifications, 60000); // Check every minute
        }"""

new_init_end_str = """            // Setup periodic polling for notifications
            setInterval(fetchNotifications, 60000); // Check every minute
            
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
