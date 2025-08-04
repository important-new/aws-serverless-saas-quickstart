# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import datetime

class Product:
    def __init__(self, tenant_id, product_id, sku, name, price, category, created_at=None, updated_at=None):
        self.tenant_id = tenant_id
        self.product_id = product_id
        self.sku = sku
        self.name = name
        self.price = price
        self.category = category
        self.created_at = created_at
        self.updated_at = updated_at

    @property
    def key(self):
        """复合键，保持向后兼容"""
        return f"{self.tenant_id}:{self.product_id}"

    def to_dynamodb_item(self):
        """转换为DynamoDB项目格式"""
        now = datetime.datetime.now(datetime.UTC).isoformat()

        return {
            'tenant_id': self.tenant_id,
            'product_id': self.product_id,
            'sku': self.sku,
            'name': self.name,
            'price': self.price,
            'category': self.category,
            'created_at': now,
            'updated_at': now,
            'entity_type': 'PRODUCT'
        }
    
    @classmethod
    def from_dynamodb_item(cls, item):
        """从DynamoDB项目创建Product实例"""
        return cls(
            tenant_id=item['tenant_id'],
            product_id=item['product_id'],
            sku=item['sku'],
            name=item['name'],
            price=item['price'],
            category=item['category'],
            created_at=item.get('created_at'),
            updated_at=item.get('updated_at')
        )
    
    def __str__(self):
        return f"Product(tenant_id={self.tenant_id}, product_id={self.product_id}, name={self.name})"
    
    def __repr__(self):
        return self.__str__()

class Category:
    def __init__(self, id, name):
        self.id = id
        self.name = name
                

        

               

        
