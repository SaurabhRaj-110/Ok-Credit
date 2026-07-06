with open('frontend/css/admin.css', 'r', encoding='utf-8') as f:
    css = f.read()

new_css = """

/* Sidebar Drawer Fixes */
.sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 900;
    display: none;
}
.sidebar-overlay.open {
    display: block;
}

@media (max-width: 900px) {
    .sidebar {
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        z-index: 1000;
        width: 280px;
    }
    .sidebar.open {
        transform: translateX(0);
    }
    .main-content {
        margin-left: 0;
        width: 100%;
    }
    .mobile-menu-btn {
        display: block !important;
        background: white;
        border: 1px solid #e2e8f0;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
    }
}
.mobile-menu-btn {
    display: none;
}
"""

if ".sidebar-overlay" not in css:
    with open('frontend/css/admin.css', 'a', encoding='utf-8') as f:
        f.write(new_css)
