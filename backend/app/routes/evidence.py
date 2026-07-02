from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import time
from app.database import get_db_connection

router = APIRouter()

class EvidenceUpdate(BaseModel):
    merchant_id: str
    tag: Optional[str] = None
    note: Optional[str] = None

@router.post("/upload")
async def upload_evidence(
    merchant_id: str = Form(...),
    party_id: str = Form(...),
    party_type: str = Form(...),
    tag: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    try:
        # Save image
        os.makedirs("uploads/evidence", exist_ok=True)
        file_ext = os.path.splitext(file.filename)[1]
        if not file_ext:
            file_ext = ".jpg"
        filename = f"evd_{uuid.uuid4().hex[:10]}_{int(time.time())}{file_ext}"
        filepath = os.path.join("uploads", "evidence", filename)
        
        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        evidence_id = "evd_" + str(uuid.uuid4().hex)[:10]
        image_path = f"/uploads/evidence/{filename}"
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO evidence (evidence_id, merchant_id, party_id, party_type, image_path, tag, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (evidence_id, merchant_id, party_id, party_type, image_path, tag, note))
            conn.commit()
            
        return {
            "status": "success",
            "evidence_id": evidence_id,
            "image_path": image_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{party_id}")
def get_evidence(party_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM evidence 
                WHERE party_id = ? AND merchant_id = ? 
                ORDER BY created_at DESC
            """, (party_id, merchant_id))
            rows = cursor.fetchall()
            return {"status": "success", "data": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{evidence_id}")
def update_evidence(evidence_id: str, payload: EvidenceUpdate):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE evidence 
                SET tag = ?, note = ?
                WHERE evidence_id = ? AND merchant_id = ?
            """, (payload.tag, payload.note, evidence_id, payload.merchant_id))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{evidence_id}")
def delete_evidence(evidence_id: str, merchant_id: str):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Fetch image path to delete file
            cursor.execute("SELECT image_path FROM evidence WHERE evidence_id = ? AND merchant_id = ?", (evidence_id, merchant_id))
            row = cursor.fetchone()
            if row and row['image_path']:
                try:
                    # Strip leading slash for relative path
                    filepath = row['image_path'].lstrip('/')
                    if os.path.exists(filepath):
                        os.remove(filepath)
                except Exception as e:
                    print(f"Failed to delete image file: {e}")
            
            cursor.execute("DELETE FROM evidence WHERE evidence_id = ? AND merchant_id = ?", (evidence_id, merchant_id))
            conn.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
