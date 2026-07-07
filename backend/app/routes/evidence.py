from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import uuid
import os
import time
from app.database import get_db
from app.models import Evidence
from app.services.auth_service import get_current_merchant_id

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
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    jwt_merchant_id: str = Depends(get_current_merchant_id)
):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
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
        
        new_evidence = Evidence(
            evidence_id=evidence_id,
            merchant_id=merchant_id,
            party_id=party_id,
            party_type=party_type,
            image_path=image_path,
            tag=tag,
            note=note
        )
        db.add(new_evidence)
        db.commit()
            
        return {
            "status": "success",
            "evidence_id": evidence_id,
            "image_path": image_path
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{party_id}")
def get_evidence(party_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        evidences = db.query(Evidence).filter(
            Evidence.party_id == party_id, 
            Evidence.merchant_id == merchant_id
        ).order_by(Evidence.created_at.desc()).all()
        
        data = []
        for ev in evidences:
            data.append({
                "evidence_id": ev.evidence_id,
                "merchant_id": ev.merchant_id,
                "party_id": ev.party_id,
                "party_type": ev.party_type,
                "image_path": ev.image_path,
                "tag": ev.tag,
                "note": ev.note,
                "created_at": ev.created_at.isoformat() if ev.created_at else None
            })
            
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{evidence_id}")
def update_evidence(evidence_id: str, payload: EvidenceUpdate, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        ev = db.query(Evidence).filter(Evidence.evidence_id == evidence_id, Evidence.merchant_id == payload.merchant_id).first()
        if not ev:
            raise HTTPException(status_code=404, detail="Evidence not found")
            
        ev.tag = payload.tag
        ev.note = payload.note
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{evidence_id}")
def delete_evidence(evidence_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        ev = db.query(Evidence).filter(Evidence.evidence_id == evidence_id, Evidence.merchant_id == merchant_id).first()
        if ev:
            if ev.image_path:
                try:
                    filepath = ev.image_path.lstrip('/')
                    if os.path.exists(filepath):
                        os.remove(filepath)
                except Exception as e:
                    print(f"Failed to delete image file: {e}")
            db.delete(ev)
            db.commit()
            
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
