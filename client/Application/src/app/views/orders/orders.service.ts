/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Order } from './models/order.interface';

// 后端返回的订单数据接口
interface BackendOrder {
  tenant_id: string;
  order_id: string;
  order_name: string;
  order_products: BackendOrderProduct[];
  created_at?: string;
  updated_at?: string;
  entity_type?: string;
}

// 后端返回的订单产品数据接口
interface BackendOrderProduct {
  productId: string;
  price: number;
  quantity: number;
}

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  orders: Order[] = [];
  baseUrl = `${localStorage.getItem('apiGatewayUrl')}`;
  constructor(private http: HttpClient) {}

  fetch(): Observable<Order[]> {
    return this.http.get<BackendOrder[]>(`${this.baseUrl}/orders`).pipe(
      map(backendOrders => 
        backendOrders.map(backendOrder => ({
          tenantId: backendOrder.tenant_id,
          orderId: backendOrder.order_id,
          orderName: backendOrder.order_name,
          orderProducts: backendOrder.order_products,
          createdAt: backendOrder.created_at,
          updatedAt: backendOrder.updated_at,
          entityType: backendOrder.entity_type
        }))
      )
    );
  }

  get(orderKey: string): Observable<Order> {
    const url = `${this.baseUrl}/order/${orderKey}`;
    return this.http.get<BackendOrder>(url).pipe(
      map(backendOrder => ({
        tenantId: backendOrder.tenant_id,
        orderId: backendOrder.order_id,
        orderName: backendOrder.order_name,
        orderProducts: backendOrder.order_products,
        createdAt: backendOrder.created_at,
        updatedAt: backendOrder.updated_at,
        entityType: backendOrder.entity_type
      }))
    );
  }

  create(order: Order): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/order`, order);
  }

  update(order: Order): Observable<Order> {
    const orderKey = `${order.tenantId}:${order.orderId}`;
    const url = `${this.baseUrl}/order/${orderKey}`;
    return this.http.put<Order>(url, order);
  }

  delete(order: Order): Observable<any> {
    const orderKey = `${order.tenantId}:${order.orderId}`;
    const url = `${this.baseUrl}/order/${orderKey}`;
    return this.http.delete(url);
  }
}
