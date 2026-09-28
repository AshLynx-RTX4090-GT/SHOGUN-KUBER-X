import hashlib
import hmac
import json
from datetime import datetime, timezone
from uuid import uuid4

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import PaymentOrder, PaymentStatus, ProcessedWebhook

router = APIRouter(prefix="/api/payments", tags=["payments"])
client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

# Prices are server-owned and Razorpay accepts amounts in paise.
CATALOG = {
    "subscription": {
        "starter": {"name": "Starter", "amount": 199900},
        "scale": {"name": "Scale", "amount": 599900},
        "enterprise": {"name": "Enterprise", "amount": 1499900},
    },
    "one-time": {
        "incident-pack": {"name": "Incident Response Pack", "amount": 249900},
        "migration-pack": {"name": "Cloud Migration Pack", "amount": 899900},
    },
}


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    plan_id: str
    purchase_type: str = "subscription"


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def get_plan(plan_id: str, purchase_type: str) -> dict:
    plan = CATALOG.get(purchase_type, {}).get(plan_id)
    if not plan:
        raise HTTPException(400, "Unknown billing plan.")
    return plan


def mark_paid(db: Session, order: PaymentOrder, payment_id: str) -> PaymentOrder:
    """Perform the idempotent PENDING -> PAID transition."""
    if order.status == PaymentStatus.PAID:
        if order.razorpay_payment_id != payment_id:
            raise HTTPException(409, "Order is already paid by another payment.")
        return order
    if order.status == PaymentStatus.FAILED:
        raise HTTPException(409, "A failed order cannot be fulfilled.")
    order.status = PaymentStatus.PAID
    order.razorpay_payment_id = payment_id
    order.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    # Add durable entitlement/invoice fulfillment via an outbox worker here.
    return order


@router.get("/status")
def payment_status():
    return {
        "configured": bool(settings.razorpay_key_id and settings.razorpay_key_secret),
        "mode": "live" if settings.razorpay_key_id.startswith("rzp_live_") else "test",
        "methods": ["UPI", "Credit card", "Debit card"],
    }


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db)):
    plan = get_plan(payload.plan_id, payload.purchase_type)
    receipt = f"kx_{uuid4().hex[:28]}"
    try:
        razorpay_order = client.order.create({
            "amount": plan["amount"], "currency": "INR", "receipt": receipt,
            "notes": {"product": "Shogun KUBER X", "plan": plan["name"]},
        })
    except razorpay.errors.BadRequestError:
        raise HTTPException(502, "Razorpay rejected the order request.")
    except Exception:
        raise HTTPException(503, "Payment provider is temporarily unavailable.")

    order = PaymentOrder(
        razorpay_order_id=razorpay_order["id"], amount_paise=plan["amount"],
        currency="INR", receipt=receipt, plan_id=payload.plan_id,
        purchase_type=payload.purchase_type, status=PaymentStatus.PENDING,
    )
    db.add(order)
    db.commit()
    return {"keyId": settings.razorpay_key_id, "orderId": order.razorpay_order_id,
            "amount": order.amount_paise, "currency": order.currency}


@router.post("/verify")
def verify_payment(payload: VerifyPaymentRequest, db: Session = Depends(get_db)):
    order = db.query(PaymentOrder).filter(
        PaymentOrder.razorpay_order_id == payload.razorpay_order_id
    ).with_for_update().first()
    if not order:
        raise HTTPException(404, "Unknown payment order.")
    try:
        # The persisted server-created order ID is authoritative.
        client.utility.verify_payment_signature({
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(400, "Invalid payment signature.")
    paid = mark_paid(db, order, payload.razorpay_payment_id)
    return {"verified": True, "fulfilled": True, "paymentId": paid.razorpay_payment_id}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()  # Verify unmodified bytes.
    signature = request.headers.get("X-Razorpay-Signature")
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Invalid webhook signature.")

    payload_hash = hashlib.sha256(raw_body).hexdigest()
    event = json.loads(raw_body)
    try:
        db.add(ProcessedWebhook(payload_hash=payload_hash, event=event.get("event", "unknown")))
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"received": True, "duplicate": True}

    payment = event.get("payload", {}).get("payment", {}).get("entity", {})
    order = db.query(PaymentOrder).filter(
        PaymentOrder.razorpay_order_id == payment.get("order_id")
    ).with_for_update().first()
    if order and event.get("event") in {"payment.captured", "order.paid"} and payment.get("id"):
        mark_paid(db, order, payment["id"])
    elif order and event.get("event") == "payment.failed" and order.status == PaymentStatus.PENDING:
        order.status = PaymentStatus.FAILED
        db.commit()
    else:
        db.commit()
    return {"received": True}
