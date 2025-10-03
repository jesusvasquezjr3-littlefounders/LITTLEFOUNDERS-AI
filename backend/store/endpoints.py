from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Product, Purchase, User, Transaction, TransactionType
from ..schemas import ProductCreate, ProductResponse, PurchaseCreate, PurchaseResponse

router = APIRouter(prefix="/store", tags=["Store"])


@router.get("/products", response_model=List[ProductResponse])
async def get_all_products(db: Session = Depends(get_db)):
    """Get all available products"""
    products = db.query(Product).filter(Product.is_active == True).all()
    return products


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a specific product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/category/{category}")
async def get_products_by_category(category: str, db: Session = Depends(get_db)):
    """Get products by category"""
    products = db.query(Product).filter(
        Product.category == category,
        Product.is_active == True
    ).all()
    return {"products": products}


@router.post("/purchase")
async def purchase_products(
    purchase: PurchaseCreate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Purchase products from the store"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    total_cost = 0.0
    purchase_items = []
    
    # Validate all products and calculate total
    for item in purchase.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        if product.in_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}"
            )
        
        item_cost = product.price * item.quantity
        total_cost += item_cost
        purchase_items.append({
            "product": product,
            "quantity": item.quantity,
            "cost": item_cost
        })
    
    # Check if user has sufficient balance
    if user.balance < total_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Required: ${total_cost:.2f}, Available: ${user.balance:.2f}"
        )
    
    # Process purchase
    user.balance -= total_cost
    purchases_created = []
    
    for item in purchase_items:
        # Create purchase record
        db_purchase = Purchase(
            user_id=user_id,
            product_id=item["product"].id,
            quantity=item["quantity"],
            total_price=item["cost"]
        )
        db.add(db_purchase)
        
        # Update product stock
        item["product"].in_stock -= item["quantity"]
        
        # Create transaction
        transaction = Transaction(
            user_id=user_id,
            transaction_type=TransactionType.PURCHASE,
            amount=item["cost"],
            description=f"Compra: {item['product'].name} x{item['quantity']}",
            category=item["product"].category
        )
        db.add(transaction)
        
        purchases_created.append(db_purchase)
    
    db.commit()
    
    return {
        "message": "Purchase successful",
        "total_cost": total_cost,
        "new_balance": user.balance,
        "items_purchased": len(purchase_items)
    }


@router.get("/purchases/{user_id}")
async def get_user_purchases(user_id: int, db: Session = Depends(get_db)):
    """Get purchase history for a user"""
    purchases = db.query(Purchase, Product).join(Product).filter(
        Purchase.user_id == user_id
    ).order_by(Purchase.purchased_at.desc()).all()
    
    return {
        "purchases": [
            {
                "id": purchase.id,
                "product_name": product.name,
                "quantity": purchase.quantity,
                "total_price": purchase.total_price,
                "purchased_at": purchase.purchased_at.isoformat()
            }
            for purchase, product in purchases
        ]
    }


@router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product (admin only)"""
    db_product = Product(
        name=product.name,
        description=product.description,
        price=product.price,
        category=product.category,
        image_url=product.image_url,
        rating=product.rating,
        in_stock=product.in_stock
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/products/{product_id}/stock")
async def update_product_stock(product_id: int, stock: int, db: Session = Depends(get_db)):
    """Update product stock"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.in_stock = stock
    db.commit()
    return {"message": "Stock updated", "new_stock": stock}
