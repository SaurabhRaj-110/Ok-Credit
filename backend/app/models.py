from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Merchant(Base):
    __tablename__ = "merchants"
    
    merchant_id = Column(String, primary_key=True, default=generate_uuid)
    phone_number = Column(String, unique=True, nullable=False, index=True)
    shop_name = Column(String, nullable=True)
    owner_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    parties = relationship("Party", back_populates="merchant", cascade="all, delete-orphan")
    inventory = relationship("Inventory", back_populates="merchant", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="merchant", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="merchant", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="merchant", cascade="all, delete-orphan")
    daily_sales = relationship("DailySale", back_populates="merchant", cascade="all, delete-orphan")

class Party(Base):
    __tablename__ = "parties"
    
    party_id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    party_type = Column(String, nullable=False)  # 'CUSTOMER' or 'SUPPLIER'
    total_balance = Column(Float, default=0.0)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", back_populates="parties")
    transactions = relationship("Transaction", back_populates="party", cascade="all, delete-orphan")

class Inventory(Base):
    __tablename__ = "inventory"
    
    item_id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    item_name = Column(String, nullable=False)
    category = Column(String, default="General")
    current_stock = Column(Float, default=0.0)
    reorder_level = Column(Float, default=10.0)
    unit = Column(String, default="items")
    price = Column(Float, default=0.0)
    purchase_price = Column(Float, default=0.0)
    entry_source = Column(String, default="Manual")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", back_populates="inventory")

class Transaction(Base):
    __tablename__ = "transactions"
    
    transaction_id = Column(String, primary_key=True, default=generate_uuid)
    party_id = Column(String, ForeignKey("parties.party_id"), nullable=False, index=True)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    txn_type = Column(String, nullable=False)  # 'GIVEN' or 'GOT'
    entry_source = Column(String, nullable=False)  # e.g., 'Manual', 'Voice AI', 'OCR'
    voice_transcript = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    party = relationship("Party", back_populates="transactions")
    merchant = relationship("Merchant", back_populates="transactions")

class Bill(Base):
    __tablename__ = "bills"
    
    bill_id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    party_id = Column(String, ForeignKey("parties.party_id"), nullable=True)
    bill_type = Column(String, nullable=False)
    total_amount = Column(Float, nullable=True, default=0.0)
    bill_date = Column(String, nullable=True)  # stored as YYYY-MM-DD string
    image_path = Column(String, nullable=True)
    items_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", back_populates="bills")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", back_populates="notifications")

class DailySale(Base):
    __tablename__ = "daily_sales"
    
    sale_id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    item = Column(String, nullable=True)
    qty = Column(Float, nullable=True)
    amount = Column(Float, nullable=False)
    note = Column(Text, nullable=True)
    entry_source = Column(String, default="Manual")
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", back_populates="daily_sales")

class MerchantUsage(Base):
    __tablename__ = "merchant_usage"
    
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), primary_key=True)
    merchant_name = Column(String, nullable=True)
    role = Column(String, default='merchant')
    current_streak = Column(Integer, default=0)
    highest_streak = Column(Integer, default=0)
    last_login = Column(String, nullable=True)
    first_login = Column(String, nullable=True)
    total_login_days = Column(Integer, default=0)
    total_sessions = Column(Integer, default=0)
    session_duration = Column(Integer, default=0)
    voice_commands = Column(Integer, default=0)
    ocr_scans = Column(Integer, default=0)
    sales_entries = Column(Integer, default=0)
    stock_updates = Column(Integer, default=0)
    khata_updates = Column(Integer, default=0)
    notifications_seen = Column(Integer, default=0)
    last_active = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    merchant = relationship("Merchant", backref="usage")

class Evidence(Base):
    __tablename__ = "evidence"
    
    evidence_id = Column(String, primary_key=True, default=generate_uuid)
    merchant_id = Column(String, ForeignKey("merchants.merchant_id"), nullable=False, index=True)
    party_id = Column(String, ForeignKey("parties.party_id"), nullable=False, index=True)
    party_type = Column(String, nullable=False)
    image_path = Column(String, nullable=False)
    tag = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    merchant = relationship("Merchant", backref="evidences")
    party = relationship("Party", backref="evidences")
