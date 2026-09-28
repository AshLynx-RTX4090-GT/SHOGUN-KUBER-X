import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    receipt: Mapped[str] = mapped_column(String(40), unique=True)
    plan_id: Mapped[str] = mapped_column(String(64))
    purchase_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    payload_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    event: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
