/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { OrderProduct } from './orderproduct.interface';

export interface Order {
  tenantId: string;
  orderId: string;
  orderName: string;
  orderProducts: OrderProduct[];
  createdAt?: string;
  updatedAt?: string;
  entityType?: string;
}
