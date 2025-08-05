/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from './models/product.interface';

// 后端返回的产品数据接口
interface BackendProduct {
  category: string;
  created_at: string;
  name: string;
  price: number;
  product_id: string;
  sku: string;
  tenant_id: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  constructor(private http: HttpClient) {}
  baseUrl = `${localStorage.getItem('apiGatewayUrl')}`;

  fetch(): Observable<Product[]> {
    return this.http.get<BackendProduct[]>(`${this.baseUrl}/products`).pipe(
      map(backendProducts => 
        backendProducts.map(backendProduct => ({
          key: backendProduct.product_id,
          tenantId: backendProduct.tenant_id,
          productId: backendProduct.product_id,
          name: backendProduct.name,
          price: backendProduct.price,
          sku: backendProduct.sku,
          category: backendProduct.category,
          createdAt: backendProduct.created_at,
          updatedAt: backendProduct.updated_at,
          entityType: 'product'
        }))
      )
    );
  }

  get(productId: string): Observable<Product> {
    const url = `${this.baseUrl}/product/${productId}`;
    return this.http.get<BackendProduct>(url).pipe(
      map(backendProduct => ({
        key: backendProduct.product_id,
        tenantId: backendProduct.tenant_id,
        productId: backendProduct.product_id,
        name: backendProduct.name,
        price: backendProduct.price,
        sku: backendProduct.sku,
        category: backendProduct.category,
        createdAt: backendProduct.created_at,
        updatedAt: backendProduct.updated_at,
        entityType: 'product'
      }))
    );
  }

  delete(product: Product) {
    const url = `${this.baseUrl}/product/${product.tenantId}:${product.productId}`;
    return this.http.delete<Product>(url);
  }

  put(product: Product) {
    const url = `${this.baseUrl}/product/${product.tenantId}:${product.productId}`;
    return this.http.put<Product>(url, product);
  }
  post(product: Product) {
    return this.http.post<Product>(`${this.baseUrl}/product`, product);
  }
}
