with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    main_py = f.read()

vocab_table = """
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS merchant_vocabulary (
                vocab_id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                phrase TEXT NOT NULL,
                correction TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id)
            );
        ''')
        
        conn.commit()"""

if "CREATE TABLE IF NOT EXISTS merchant_vocabulary" not in main_py:
    main_py = main_py.replace("conn.commit()", vocab_table)
    with open('backend/app/main.py', 'w', encoding='utf-8') as f:
        f.write(main_py)
    print("merchant_vocabulary table added")
else:
    print("already exists")
