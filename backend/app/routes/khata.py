import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from app.database import get_db_connection

router = APIRouter()

# --- PYDANTIC SCHEMAS (Data Validation) ---
class PartyCreate(BaseModel):
    merchant_id: str
    name: str
    phone_number: Optional[str] = ""
    party_type: str  # 'CUSTOMER' or 'SUPPLIER'
    initial_balance: float = 0.0
    notes: str = ""

class PartyNotesUpdate(BaseModel):
    merchant_id: str
    notes: str

class TransactionCreate(BaseModel):
    party_id: str
    merchant_id: str
    amount: float
    txn_type: str  # 'GIVEN' (Udhaar Diya) or 'GOT' (Jama Kiya)
    entry_source: str = "Manual"
    voice_transcript: Optional[str] = ""

# --- API ROUTES ---

@router.put("/party/{party_id}/notes")
def update_party_notes(party_id: str, update: PartyNotesUpdate):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE parties SET notes = ? WHERE party_id = ? AND merchant_id = ?", (update.notes, party_id, update.merchant_id))
            conn.commit()
            return {"status": "success", "message": "Notes saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/party")
def create_party(party: PartyCreate):
    party_id = "p_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO parties (party_id, merchant_id, name, phone_number, party_type, total_balance, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (party_id, party.merchant_id, party.name, party.phone_number, party.party_type, party.initial_balance, party.notes))
            
            # If there's an initial balance, log it as the first transaction
            if party.initial_balance != 0:
                txn_id = "tx_" + str(uuid.uuid4().hex)[:10]
                txn_type = 'GIVEN' if party.initial_balance > 0 else 'GOT'
                cursor.execute("""
                    INSERT INTO transactions (transaction_id, party_id, merchant_id, amount, txn_type, entry_source)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (txn_id, party_id, party.merchant_id, abs(party.initial_balance), txn_type, "Opening Balance"))
            
            conn.commit()
            
            from app.routes.notifications import generate_notification
            generate_notification(
                merchant_id=party.merchant_id,
                title="New Account Created",
                message=f"Added {party.name} as a {party.party_type.lower()}.",
                type="info",
                category="Khata",
                reference_id=party_id,
                reference_type="PARTY"
            )
            
            return {"status": "success", "party_id": party_id, "message": "Account created!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transaction")
def add_transaction(tx: TransactionCreate):
    txn_id = "tx_" + str(uuid.uuid4().hex)[:10]
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # 1. Log the transaction
            cursor.execute("""
                INSERT INTO transactions (transaction_id, party_id, merchant_id, amount, txn_type, entry_source, voice_transcript)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (txn_id, tx.party_id, tx.merchant_id, tx.amount, tx.txn_type, tx.entry_source, tx.voice_transcript))
            
            # 2. Update the party's running balance
            # Math: If GIVEN (Udhaar), balance increases. If GOT (Jama), balance decreases.
            balance_change = tx.amount if tx.txn_type == 'GIVEN' else -tx.amount
            cursor.execute("""
                UPDATE parties SET total_balance = total_balance + ? WHERE party_id = ? AND merchant_id = ?
            """, (balance_change, tx.party_id, tx.merchant_id))
            
            conn.commit()
            
            from app.routes.notifications import generate_notification
            
            # Fetch party name for better notification
            cursor.execute("SELECT name, party_type FROM parties WHERE party_id = ? AND merchant_id = ?", (tx.party_id, tx.merchant_id))
            row = cursor.fetchone()
            party_name = row["name"] if row else "Party"
            
            title = ""
            msg = ""
            if tx.txn_type == "GIVEN":
                title = "New Udhaar Added"
                msg = f"{party_name} - ₹{tx.amount} udhaar added."
            else:
                title = "Payment Received"
                msg = f"₹{tx.amount} payment received from {party_name}."
                
            generate_notification(
                merchant_id=tx.merchant_id,
                title=title,
                message=msg,
                type="success",
                category="Khata",
                reference_id=txn_id,
                reference_type="TRANSACTION"
            )
            
            return {"status": "success", "transaction_id": txn_id, "message": "Transaction saved!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/party/{party_id}")
def delete_party(party_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM transactions WHERE party_id = ? AND merchant_id = ?", (party_id, merchant_id))
            cursor.execute("DELETE FROM evidence WHERE party_id = ? AND merchant_id = ?", (party_id, merchant_id))
            cursor.execute("DELETE FROM parties WHERE party_id = ? AND merchant_id = ?", (party_id, merchant_id))
            conn.commit()
            return {"status": "success", "message": "Account completely deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/sync/{merchant_id}")
def sync_all_data(merchant_id: str):
    try:
        with get_db_connection() as conn:
            # This makes SQLite return dictionaries instead of raw tuples
            conn.row_factory = sqlite3.Row  
            cursor = conn.cursor()
            
            # This will Fetch all Grahaks and Suppliers
            cursor.execute("SELECT * FROM parties WHERE merchant_id = ?", (merchant_id,))
            parties = [dict(row) for row in cursor.fetchall()]
            
            # It fetches all Transactions (Newest first)
            cursor.execute("SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC", (merchant_id,))
            transactions = [dict(row) for row in cursor.fetchall()]
            
            for party in parties:
                party["transactions"] = [tx for tx in transactions if tx["party_id"] == party["party_id"]]
                
            # Fetch all Stock/Inventory
            cursor.execute("SELECT * FROM inventory WHERE merchant_id = ?", (merchant_id,))
            inventory = [dict(row) for row in cursor.fetchall()]

            # Fetch daily sales
            cursor.execute("SELECT * FROM daily_sales WHERE merchant_id = ? ORDER BY timestamp DESC", (merchant_id,))
            daily_sales = [dict(row) for row in cursor.fetchall()]
            
            return {
                "status": "success",
                "parties": parties,
                "inventory": inventory,
                "daily_sales": daily_sales
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))