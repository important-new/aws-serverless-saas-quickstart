# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import boto3
from botocore.exceptions import ClientError
import uuid
import json
import logger
import metrics_manager
from datetime import datetime

from product_models import Product
from types import SimpleNamespace
from boto3.dynamodb.conditions import Key, Attr

# 环境变量
is_pooled_deploy = os.environ['IS_POOLED_DEPLOY']
table_name = os.environ['PRODUCT_TABLE_NAME']
dynamodb = None

def get_product(event, key):
    """
    获取单个产品
    使用新的键结构: tenant_id:product_id
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        # 解析键: tenant_id:product_id
        tenant_id, product_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Getting product: tenant_id={tenant_id}, product_id={product_id}")
        
        # 直接使用tenant_id和product_id作为键
        response = table.get_item(
            Key={'tenant_id': tenant_id, 'product_id': product_id},
            ReturnConsumedCapacity='TOTAL'
        )
        
        if 'Item' not in response:
            raise Exception(f'Product not found: {key}')
            
        item = response['Item']
        product = Product.from_dynamodb_item(item)
        
        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error getting a product', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info(f"GetItem succeeded: {product}")
        return product

def delete_product(event, key):
    """
    删除产品
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        # 解析键: tenant_id:product_id
        tenant_id, product_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Deleting product: tenant_id={tenant_id}, product_id={product_id}")
        
        # 直接使用tenant_id和product_id作为键
        response = table.delete_item(
            Key={'tenant_id': tenant_id, 'product_id': product_id}, 
            ReturnConsumedCapacity='TOTAL'
        )
        
        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error deleting a product', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info("DeleteItem succeeded")
        return response

def create_product(event, payload):
    """
    创建新产品
    使用租户ID作为分区键，UUID作为排序键
    """
    tenant_id = event['requestContext']['authorizer']['tenantId']    
    table = __get_dynamodb_table(event, dynamodb)
    
    # 生成产品ID
    product_id = str(uuid.uuid4())
    
    # 创建产品对象
    product = Product(
        tenant_id=tenant_id,
        product_id=product_id,
        sku=payload.sku,
        name=payload.name,
        price=payload.price,
        category=payload.category
    )
    
    try:
        # 转换为DynamoDB格式
        item = product.to_dynamodb_item()
        
        response = table.put_item(
            Item=item,
            ReturnConsumedCapacity='TOTAL'
        )
        
        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error adding a product', e)
    else:
        logger.info(f"PutItem succeeded: {product}")
        return product

def update_product(event, payload, key):
    """
    更新产品
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        # 解析键: tenant_id:product_id
        tenant_id, product_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Updating product: tenant_id={tenant_id}, product_id={product_id}")
        
        # 直接使用tenant_id和product_id作为键
        response = table.update_item(
            Key={'tenant_id': tenant_id, 'product_id': product_id},
            UpdateExpression="set sku=:sku, #n=:productName, price=:price, category=:category, updated_at=:updated_at",
            ExpressionAttributeNames={'#n': 'name'},
            ExpressionAttributeValues={
                ':sku': payload.sku,
                ':productName': payload.name,
                ':price': payload.price,
                ':category': payload.category,
                ':updated_at': datetime.datetime.now(datetime.UTC).isoformat()
            },
            ReturnValues="UPDATED_NEW",
            ReturnConsumedCapacity='TOTAL'
        )
        
        # 创建更新后的产品对象
        updated_item = response['Attributes']
        product = Product.from_dynamodb_item(updated_item)
        
        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error updating a product', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info(f"UpdateItem succeeded: {product}")
        return product

def get_products(event, tenant_id):
    """
    获取租户的所有产品
    使用简化的查询，无需分片
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        logger.log_with_tenant_context(event, f"Getting all products for tenant: {tenant_id}")

        # 直接使用租户ID作为分区键查询
        response = table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            ReturnConsumedCapacity='TOTAL'
        )
        
        # 转换为Product对象列表
        products = [Product.from_dynamodb_item(item) for item in response['Items']]
        
        # 处理分页（如果需要）
        while 'LastEvaluatedKey' in response:
            response = table.query(
                KeyConditionExpression=Key('tenant_id').eq(tenant_id),
                ExclusiveStartKey=response['LastEvaluatedKey'],
                ReturnConsumedCapacity='TOTAL'
            )
            products.extend([Product.from_dynamodb_item(item) for item in response['Items']])
        
        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error getting all products', e)
    else:
        logger.info(f"Get products succeeded: {len(products)} products found")
        return products

def get_products_by_category(event, tenant_id, category):
    """
    按类别获取产品
    使用FilterExpression进行类别过滤（适用于中小数据量场景）
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        logger.log_with_tenant_context(event, f"Getting products by category: tenant_id={tenant_id}, category={category}")
        
        # 使用FilterExpression进行类别过滤
        response = table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            FilterExpression=Attr('category').eq(category),
            ReturnConsumedCapacity='TOTAL'
        )
        
        products = [Product.from_dynamodb_item(item) for item in response['Items']]
        
        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error getting products by category', e)
    else:
        logger.info(f"Get products by category succeeded: {len(products)} products found")
        return products

def search_products(event, tenant_id, search_term):
    """
    搜索产品（按名称或SKU）
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        logger.log_with_tenant_context(event, f"Searching products: tenant_id={tenant_id}, search_term={search_term}")
        
        pk = f"TENANT#{tenant_id}"
        
        # 使用contains进行模糊搜索
        response = table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            FilterExpression=Attr('name').contains(search_term) | Attr('sku').contains(search_term),
            ReturnConsumedCapacity='TOTAL'
        )
        
        products = [Product.from_dynamodb_item(item) for item in response['Items']]
        
        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error searching products', e)
    else:
        logger.info(f"Search products succeeded: {len(products)} products found")
        return products

def __get_dynamodb_table(event, dynamodb):    
    """
    获取DynamoDB表实例
    支持池化和专用部署模式
    """
    if (is_pooled_deploy=='true'):
        accesskey = event['requestContext']['authorizer']['accesskey']
        secretkey = event['requestContext']['authorizer']['secretkey']
        sessiontoken = event['requestContext']['authorizer']['sessiontoken']    
        dynamodb = boto3.resource('dynamodb',
                aws_access_key_id=accesskey,
                aws_secret_access_key=secretkey,
                aws_session_token=sessiontoken
                )       
    else:
        if not dynamodb:
            dynamodb = boto3.resource('dynamodb')
        
    return dynamodb.Table(table_name)
