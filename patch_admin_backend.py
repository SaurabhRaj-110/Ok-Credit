import re

with open('backend/app/routes/admin.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoints = """
@router.get("/merchants")
def get_all_merchants():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.*, m.shop_name, m.owner_name, m.phone_number,
            (SELECT COUNT(*) FROM transactions t WHERE t.merchant_id = u.merchant_id) as txn_count
            FROM merchant_usage u
            JOIN merchants m ON u.merchant_id = m.merchant_id
            ORDER BY u.last_active DESC
        ''')
        merchants = [dict(row) for row in cursor.fetchall()]
        
        fifteen_mins_ago = (datetime.datetime.now() - datetime.timedelta(minutes=15)).isoformat()
        for m in merchants:
            m['status'] = 'Active' if m['last_active'] and m['last_active'] >= fifteen_mins_ago else 'Offline'
            
        return {"status": "SUCCESS", "data": merchants}

@router.get("/streaks")
def get_streaks():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.*, m.shop_name
            FROM merchant_usage u
            JOIN merchants m ON u.merchant_id = m.merchant_id
            ORDER BY u.current_streak DESC
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/transactions")
def get_all_transactions():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/bills")
def get_all_bills():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM bills
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/voice-commands")
def get_voice_commands():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM transactions
            WHERE voice_transcript IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/inventory")
def get_all_inventory():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM inventory
            ORDER BY merchant_id
            LIMIT 500
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}

@router.get("/alerts")
def get_alerts():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Find low stock alerts
        cursor.execute('''
            SELECT * FROM inventory
            WHERE current_stock < reorder_level
            LIMIT 100
        ''')
        return {"status": "SUCCESS", "data": [dict(row) for row in cursor.fetchall()]}
"""

content += new_endpoints

with open('backend/app/routes/admin.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated admin.py endpoints")
