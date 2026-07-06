import re

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Remove home streak card completely
streak_card_regex = re.compile(r'<div class="streak-card" id="homeStreakCard"[^>]*>.*?</div>\s*</div>', re.DOTALL)
html = streak_card_regex.sub('', html)

# 2. Inject streak widget into drawer
drawer_sec_title_pos = html.find('<div class="drawer-sec-title">Today\'s Overview</div>')
if drawer_sec_title_pos != -1:
    new_drawer_content = '''
            <div class="drawer-section">
                <div class="drawer-sec-title">Your Activity & Streak</div>
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%); border-radius: 16px; padding: 16px; border: 1px solid #a7f3d0; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 12px; font-weight: 700; color: #047857; margin-bottom: 4px;">Current Streak</div>
                        <div id="drawerStreakDays" style="font-size: 24px; font-weight: 800; color: #065f46;">0 Days 🔥</div>
                        <div style="font-size: 11px; font-weight: 600; color: #059669; margin-top: 2px;">Consistency is key!</div>
                    </div>
                </div>
            </div>
            
            <div class="drawer-sec-title">Today's Overview</div>'''
    html = html.replace('<div class="drawer-sec-title">Today\'s Overview</div>', new_drawer_content)

# 3. Update Logout logic (we will just find the div and replace it)
logout_html = '''<div class="drawer-menu-item" style="color: var(--red);">
                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>
                    <div class="dmi-text">Logout</div>'''
new_logout_html = '''<div class="drawer-menu-item" style="color: var(--red); cursor: pointer;" onclick="logoutMerchant()">
                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>
                    <div class="dmi-text">Logout</div>'''
html = html.replace(logout_html, new_logout_html)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
