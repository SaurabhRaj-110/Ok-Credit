import logging
import uuid
import time
from sqlite3 import Connection
from app.database import get_db_connection

logger = logging.getLogger("ShopSathiTransactionEngine")

class TransactionEngine:
    def __init__(self):
        pass

    def validate_entities(self, merchant_id: str, ai_actions: list) -> dict:
        """
        Validates all items and parties in the DB.
        Returns a PreviewPayload to show on the frontend.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        
        preview = {
            "is_valid": True,
            "validation_errors": [],
            "actions": [],
            "grand_total": 0.0,
            "generate_bill": False
        }
        
        try:
            for act in ai_actions:
                action_type = act.get("action", "")
                
                if action_type == "GENERATE_BILL":
                    preview["generate_bill"] = True
                    continue

                amount = float(act.get("amount") or 0)
                
                # Handle Khata operations
                if "CUSTOMER" in action_type or "SUPPLIER" in action_type:
                    target_name = act.get("target_name")
                    if not target_name:
                        continue
                        
                    party_type = act.get("party_type") or ("SUPPLIER" if "SUPPLIER" in action_type else "CUSTOMER")
                    
                    # Search DB for party
                    cursor.execute(
                        "SELECT party_id, name, total_balance FROM parties WHERE merchant_id = ? AND party_type = ? AND LOWER(name) LIKE ?",
                        (merchant_id, party_type, f"%{target_name.lower()}%")
                    )
                    rows = cursor.fetchall()
                    
                    if len(rows) == 1:
                        party = rows[0]
                        before_bal = party["total_balance"]
                        # CREDIT means they took items on udhaar (adds to their balance)
                        # PAYMENT means they paid money (subtracts from their balance)
                        is_payment = "PAYMENT" in action_type or "REPAYMENT" in action_type
                        change = -amount if is_payment else amount
                        
                        preview["actions"].append({
                            "type": "KHATA",
                            "action_raw": action_type,
                            "party_id": party["party_id"],
                            "name": party["name"],
                            "party_type": party_type,
                            "amount": amount,
                            "before_balance": before_bal,
                            "after_balance": before_bal + change,
                            "is_new": False
                        })
                    else:
                        # Will create new party
                        new_party_id = f"party_{uuid.uuid4().hex[:6]}"
                        is_payment = "PAYMENT" in action_type or "REPAYMENT" in action_type
                        change = -amount if is_payment else amount
                        
                        preview["actions"].append({
                            "type": "KHATA",
                            "action_raw": action_type,
                            "party_id": new_party_id,
                            "name": target_name.title(),
                            "party_type": party_type,
                            "amount": amount,
                            "before_balance": 0.0,
                            "after_balance": change,
                            "is_new": True
                        })
                
                # Handle Stock operations
                elif "STOCK" in action_type:
                    item_name = act.get("item_name")
                    if not item_name:
                        continue
                        
                    try:
                        qty = float(act.get("quantity") or 1)
                    except:
                        qty = 1.0
                        
                    cursor.execute(
                        "SELECT item_id, item_name, current_stock, price, unit FROM inventory WHERE merchant_id = ? AND LOWER(item_name) LIKE ?",
                        (merchant_id, f"%{item_name.lower()}%")
                    )
                    rows = cursor.fetchall()
                    
                    # Fallback to loose matching if strict like fails
                    if not rows:
                        first_word = item_name.split(' ')[0].lower()
                        cursor.execute(
                            "SELECT item_id, item_name, current_stock, price, unit FROM inventory WHERE merchant_id = ? AND LOWER(item_name) LIKE ?",
                            (merchant_id, f"%{first_word}%")
                        )
                        rows = cursor.fetchall()
                        
                    if len(rows) > 0:
                        item = rows[0]
                        before_stock = item["current_stock"]
                        is_sale = "REDUCE" in action_type
                        change = -qty if is_sale else qty
                        
                        if is_sale and before_stock + change < 0:
                            preview["validation_errors"].append(f"Insufficient stock for {item['item_name']}. Current: {before_stock}, Requested: {qty}.")
                            preview["is_valid"] = False
                            
                        # Use LLM price if available, else DB price
                        price = amount if amount > 0 else (item["price"] * qty)
                        
                        if is_sale:
                            preview["grand_total"] += price
                            
                        preview["actions"].append({
                            "type": "STOCK",
                            "action_raw": action_type,
                            "item_id": item["item_id"],
                            "item_name": item["item_name"],
                            "qty": qty,
                            "unit": act.get("unit") or item["unit"],
                            "price": price,
                            "before_stock": before_stock,
                            "after_stock": before_stock + change,
                            "is_sale": is_sale,
                            "is_new": False
                        })
                    else:
                        # Item not found
                        preview["validation_errors"].append(f"Item not found in inventory: {item_name}")
                        preview["is_valid"] = False
                        
                        preview["actions"].append({
                            "type": "STOCK",
                            "action_raw": action_type,
                            "item_id": None,
                            "item_name": item_name,
                            "qty": qty,
                            "unit": act.get("unit") or "items",
                            "price": amount,
                            "before_stock": 0,
                            "after_stock": 0,
                            "is_sale": "REDUCE" in action_type,
                            "is_new": True
                        })
                        
        finally:
            conn.close()
            
        return preview

    def execute_preview(self, merchant_id: str, preview: dict) -> dict:
        """
        Executes a validated preview using SQLite transactions.
        If anything fails, it rolls back.
        """
        if not preview.get("is_valid"):
            raise ValueError("Cannot execute invalid preview payload")
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("BEGIN TRANSACTION")
            
            bill_id = f"bill_{uuid.uuid4().hex[:8]}" if preview.get("generate_bill") else None
            
            for act in preview.get("actions", []):
                if act["type"] == "KHATA":
                    if act["is_new"]:
                        cursor.execute(
                            "INSERT INTO parties (party_id, merchant_id, name, party_type, total_balance) VALUES (?, ?, ?, ?, ?)",
                            (act["party_id"], merchant_id, act["name"], act["party_type"], act["after_balance"])
                        )
                    else:
                        cursor.execute(
                            "UPDATE parties SET total_balance = ? WHERE party_id = ? AND merchant_id = ?",
                            (act["after_balance"], act["party_id"], merchant_id)
                        )
                    
                    txn_type = "GOT" if act["before_balance"] > act["after_balance"] else "GIVEN"
                    # Add to transactions history
                    cursor.execute(
                        "INSERT INTO transactions (transaction_id, party_id, merchant_id, amount, txn_type, entry_source) VALUES (?, ?, ?, ?, ?, ?)",
                        (f"txn_{uuid.uuid4().hex[:8]}", act["party_id"], merchant_id, act["amount"], txn_type, "Voice AI")
                    )
                    
                elif act["type"] == "STOCK":
                    if not act["is_new"]:
                        cursor.execute(
                            "UPDATE inventory SET current_stock = ? WHERE item_id = ? AND merchant_id = ?",
                            (act["after_stock"], act["item_id"], merchant_id)
                        )
                        
                        # Add to daily_sales
                        sale_type = "Sale" if act["is_sale"] else "Purchase"
                        cursor.execute(
                            "INSERT INTO daily_sales (sale_id, merchant_id, type, item, qty, amount, entry_source) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (f"ds_{uuid.uuid4().hex[:8]}", merchant_id, sale_type, act["item_name"], act["qty"], act["price"], "Voice AI")
                        )
                        
            # Create Bill if requested
            if bill_id:
                cursor.execute(
                    "INSERT INTO bills (bill_id, merchant_id, bill_type, total_amount, bill_date) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    (bill_id, merchant_id, "Voice Generated", preview["grand_total"])
                )
                        
            conn.commit()
            return {"status": "SUCCESS", "msg": "Transactions saved atomically", "bill_id": bill_id}
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Transaction failed, rolled back: {e}")
            raise e
        finally:
            conn.close()
