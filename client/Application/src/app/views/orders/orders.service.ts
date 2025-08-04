/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Order } from './models/order.interface';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  orders: Order[] = [];
  baseUrl = `${localStorage.getItem('apiGatewayUrl')}`;
  constructor(private http: HttpClient) {}

  fetch(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`);
  }

  get(orderKey: string): Observable<Order> {
    const url = `${this.baseUrl}/order/${orderKey}`;
    return this.http.get<Order>(url);
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
