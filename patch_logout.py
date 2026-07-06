with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('<div class="drawer-menu-item" style="color: var(--red);">\n                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>\n                    <div class="dmi-text">Logout</div>', 
                    '<div class="drawer-menu-item" style="color: var(--red); cursor: pointer;" onclick="logoutMerchant()">\n                    <div class="dmi-icon"><i class="ti ti-logout"></i></div>\n                    <div class="dmi-text">Logout</div>')

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
