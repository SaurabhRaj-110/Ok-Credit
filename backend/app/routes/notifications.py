from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import uuid
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Notification
from app.services.auth_service import get_current_merchant_id

router = APIRouter()

class NotificationCreate(BaseModel):
    merchant_id: str
    title: str
    message: str
    type: str
    category: str
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None

@router.get("/")
def get_notifications(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        notifications = db.query(Notification).filter(Notification.merchant_id == merchant_id).order_by(Notification.timestamp.desc()).all()
        data = []
        for n in notifications:
            data.append({
                "id": n.id,
                "merchant_id": n.merchant_id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "category": n.category,
                "reference_id": n.reference_id,
                "reference_type": n.reference_type,
                "is_read": n.is_read,
                "timestamp": n.timestamp.isoformat() if n.timestamp else None
            })
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_notification(payload: NotificationCreate, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if payload.merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    notif_id = "notif_" + str(uuid.uuid4().hex)[:10]
    try:
        new_notif = Notification(
            id=notif_id,
            merchant_id=payload.merchant_id,
            title=payload.title,
            message=payload.message,
            type=payload.type,
            category=payload.category,
            reference_id=payload.reference_id,
            reference_type=payload.reference_type
        )
        db.add(new_notif)
        db.commit()
        return {"status": "success", "id": notif_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{notif_id}/read")
def mark_read(notif_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        notif = db.query(Notification).filter(Notification.id == notif_id, Notification.merchant_id == merchant_id).first()
        if notif:
            notif.is_read = 1
            db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/read_all")
def mark_all_read(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        db.query(Notification).filter(Notification.merchant_id == merchant_id).update({"is_read": 1})
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{notif_id}")
def delete_notification(notif_id: str, merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        db.query(Notification).filter(Notification.id == notif_id, Notification.merchant_id == merchant_id).delete()
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/")
def clear_all(merchant_id: str, db: Session = Depends(get_db), jwt_merchant_id: str = Depends(get_current_merchant_id)):
    if merchant_id != jwt_merchant_id:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    try:
        db.query(Notification).filter(Notification.merchant_id == merchant_id).delete()
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def generate_notification(merchant_id: str, title: str, message: str, type: str, category: str, reference_id: str = None, reference_type: str = None):
    notif_id = "notif_" + str(uuid.uuid4().hex)[:10]
    db = SessionLocal()
    try:
        new_notif = Notification(
            id=notif_id,
            merchant_id=merchant_id,
            title=title,
            message=message,
            type=type,
            category=category,
            reference_id=reference_id,
            reference_type=reference_type
        )
        db.add(new_notif)
        db.commit()
    except Exception as e:
        db.rollback()
        print("Failed to generate notification:", e)
    finally:
        db.close()
