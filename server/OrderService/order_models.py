# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import datetime

class Order:
    def __init__(self, tenant_id, order_id, order_name, order_products, created_at=None, updated_at=None):
        self.tenant_id = tenant_id
        self.order_id = order_id
        self.order_name = order_name
        self.order_products = order_products
        self.created_at = created_at
        self.updated_at = updated_at

    @property
    def key(self):
        """复合键，保持向后兼容"""
        return f"{self.tenant_id}:{self.order_id}"

    def to_dynamodb_item(self):
        """转换为DynamoDB项目格式"""
        now = datetime.datetime.now(datetime.UTC).isoformat()

        return {
            'tenant_id': self.tenant_id,
            'order_id': self.order_id,
            'order_name': self.order_name,
            'order_products': self.order_products,
            'created_at': self.created_at or now,
            'updated_at': self.updated_at or now,
            'entity_type': 'ORDER'
        }

    @classmethod
    def from_dynamodb_item(cls, item):
        """从DynamoDB项目创建Order实例"""
        return cls(
            tenant_id=item['tenant_id'],
            order_id=item['order_id'],
            order_name=item['order_name'],
            order_products=item['order_products'],
            created_at=item.get('created_at'),
            updated_at=item.get('updated_at')
        )

    def __str__(self):
        return f"Order(tenant_id={self.tenant_id}, order_id={self.order_id}, name={self.order_name})"

    def __repr__(self):
        return self.__str__()

class OrderProduct:
    def __init__(self, product_id, price, quantity):
        self.product_id = product_id
        self.price = price
        self.quantity = quantity



