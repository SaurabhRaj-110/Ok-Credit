# Implements structural details of transactions and their related entities ledger
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class TransactionCreate(BaseModel):
    party_id: int
    amount: float
    tx_type: str # 'udhaar', 'payment', 'order'
    note: str

@router.post("/api/transactions")
async def log_transaction(tx: TransactionCreate):
    # TODO: Insert transaction into DB, then update the party's total balance
    print(f"Logging transaction: {tx.tx_type} of {tx.amount} for party {tx.party_id}")
    return {"status": "success"}