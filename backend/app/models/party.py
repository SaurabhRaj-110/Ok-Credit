# Controls cutomer structural account details
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

# Schema for incoming data
class PartyCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    balance: float
    party_type: str # 'customer' or 'supplier'

@router.get("/api/parties")
async def get_all_parties():
    # TODO: Replace with actual DB query like: return db.query(Party).all()
    return {"message": "Will return all customers and suppliers from DB"}

@router.post("/api/parties")
async def create_party(party: PartyCreate):
     # TODO: Replace with DB insert like: new_party = Party(**party.dict()); db.add(new_party)
    print(f"Saving {party.name} to database with balance {party.balance}")
    return {"status": "success", "data": party}