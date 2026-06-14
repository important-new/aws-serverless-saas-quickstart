# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import boto3
from botocore.exceptions import ClientError
import uuid
from order_models import Order
import json
import utils
import logger
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
import metrics_manager

is_pooled_deploy = os.environ['IS_POOLED_DEPLOY']
table_name = os.environ['ORDER_TABLE_NAME']
dynamodb = None

def get_order(event, key):
    """
    获取单个订单
    使用新的键结构: tenant_id:order_id
    """
    table = __get_dynamodb_table(event, dynamodb)

    try:
        # 解析键: tenant_id:order_id
        tenant_id, order_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Getting order: tenant_id={tenant_id}, order_id={order_id}")
        
        # 直接使用tenant_id和order_id作为键
        response = table.get_item(
            Key={'tenant_id': tenant_id, 'order_id': order_id},
            ReturnConsumedCapacity='TOTAL'
        )
        
        if 'Item' not in response:
            raise Exception(f'Order not found: {key}')
            
        item = response['Item']
        order = Order.from_dynamodb_item(item)

        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])

    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error getting a order', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info(f"GetItem succeeded: {order}")
        return order

def delete_order(event, key):
    """
    删除订单
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        # 解析键: tenant_id:order_id
        tenant_id, order_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Deleting order: tenant_id={tenant_id}, order_id={order_id}")
        
        # 直接使用tenant_id和order_id作为键
        response = table.delete_item(
            Key={'tenant_id': tenant_id, 'order_id': order_id},
            ReturnConsumedCapacity='TOTAL'
        )

        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error deleting a order', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info("DeleteItem succeeded")
        return response

def create_order(event, payload):
    """
    创建新订单
    使用租户ID作为分区键，UUID作为排序键
    """
    tenant_id = event['requestContext']['authorizer']['tenantId']
    table = __get_dynamodb_table(event, dynamodb)
    
    # 生成订单ID
    order_id = str(uuid.uuid4())
    
    # 创建订单对象
    order = Order(
        tenant_id=tenant_id,
        order_id=order_id,
        order_name=payload['orderName'],
        order_products=payload['orderProducts']
    )

    try:
        # 转换为DynamoDB格式
        item = order.to_dynamodb_item()
        
        response = table.put_item(
            Item=item,
            ReturnConsumedCapacity='TOTAL'
        )

        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error adding a order', e)
    else:
        logger.info(f"PutItem succeeded: {order}")
        return order

def update_order(event, payload, key):
    """
    更新订单
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        # 解析键: tenant_id:order_id
        tenant_id, order_id = key.split(":", 1)
        logger.log_with_tenant_context(event, f"Updating order: tenant_id={tenant_id}, order_id={order_id}")
        
        # 直接使用tenant_id和order_id作为键
        response = table.update_item(
            Key={'tenant_id': tenant_id, 'order_id': order_id},
            UpdateExpression="set order_name=:orderName, order_products=:orderProducts, updated_at=:updated_at",
            ExpressionAttributeValues={
                ':orderName': payload['orderName'],
                ':orderProducts': get_order_products_dict(payload['orderProducts']),
                ':updated_at': datetime.now(timezone.utc).isoformat()
            },
            ReturnValues="ALL_NEW",
            ReturnConsumedCapacity='TOTAL'
        )
        
        # 创建更新后的订单对象
        updated_item = response['Attributes']
        order = Order.from_dynamodb_item(updated_item)

        metrics_manager.record_metric(event, "WriteCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error updating a order', e)
    except ValueError as e:
        logger.error(f"Invalid key format: {key}")
        raise Exception('Invalid key format', e)
    else:
        logger.info(f"UpdateItem succeeded: {order}")
        return order

def get_orders(event, tenant_id):
    """
    获取租户的所有订单
    使用简化的查询，无需分片
    """
    table = __get_dynamodb_table(event, dynamodb)
    
    try:
        logger.log_with_tenant_context(event, f"Getting all orders for tenant: {tenant_id}")

        # 直接使用租户ID作为分区键查询
        response = table.query(
            KeyConditionExpression=Key('tenant_id').eq(tenant_id),
            ReturnConsumedCapacity='TOTAL'
        )
        
        # 转换为Order对象列表
        orders = [Order.from_dynamodb_item(item) for item in response['Items']]
        
        # 处理分页（如果需要）
        while 'LastEvaluatedKey' in response:
            response = table.query(
                KeyConditionExpression=Key('tenant_id').eq(tenant_id),
                ExclusiveStartKey=response['LastEvaluatedKey'],
                ReturnConsumedCapacity='TOTAL'
            )
            orders.extend([Order.from_dynamodb_item(item) for item in response['Items']])
        
        metrics_manager.record_metric(event, "ReadCapacityUnits", "Count", response['ConsumedCapacity']['CapacityUnits'])
        
    except ClientError as e:
        logger.error(e.response['Error']['Message'])
        raise Exception('Error getting all orders', e)
    else:
        logger.info(f"Get orders succeeded: {len(orders)} orders found")
        return orders

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

def get_order_products_dict(order_products):
    """
    将订单产品列表转换为字典格式
    """
    order_product_list = []
    for product in order_products:
        order_product_list.append(product if isinstance(product, dict) else vars(product))
    return order_product_list    

  

