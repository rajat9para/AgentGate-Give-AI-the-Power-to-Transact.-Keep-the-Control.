// ============================================================
// AgentGate — Payment Reconciliation Engine
// Resolves discrepancies between Razorpay's ledger and local database
// ============================================================

import { db } from '../db/database.js';
import { auditService } from '../audit/audit-service.js';
import { budgetReservationEngine } from '../crypto/budget-reservation.js';
import { config } from '../config.js';

export interface ReconciliationReport {
  timestamp: string;
  totalOrdersChecked: number;
  reconciledCount: number;
  discrepanciesCount: number;
  actionsTaken: Array<{
    orderId: string;
    razorpayOrderId?: string;
    action: string;
    detail: string;
  }>;
}

export class PaymentReconciliationService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Performs a comprehensive reconciliation pass across all orders and payments.
   */
  public async reconcile(): Promise<ReconciliationReport> {
    const report: ReconciliationReport = {
      timestamp: new Date().toISOString(),
      totalOrdersChecked: 0,
      reconciledCount: 0,
      discrepanciesCount: 0,
      actionsTaken: [],
    };

    try {
      const allOrders = db.getAllOrders();
      report.totalOrdersChecked = allOrders.length;

      for (const order of allOrders) {
        const payments = db.getPaymentsByOrder(order.id);
        const capturedPayment = payments.find((p) => p.status === 'captured');

        // Case 1: Order is 'pending' or 'payment_failed', but has a captured payment record (e.g. Webhook captured or async success)
        if ((order.status === 'pending' || order.status === 'payment_failed') && capturedPayment) {
          db.updateOrder(order.id, {
            status: 'paid',
            payment_id: capturedPayment.id,
          });

          // Ensure daily spending is committed
          db.addDailySpending(order.user_id, capturedPayment.amount);
          db.addWeeklySpending(order.user_id, capturedPayment.amount);

          auditService.log({
            agent_id: 'reconciliation-worker',
            user_id: order.user_id,
            merchant_id: order.merchant_id,
            session_id: order.agent_session_id || 'reconciliation',
            action: 'PAYMENT_RECONCILED_AUTO_REPAIR',
            requested_amount: order.total_amount,
            approved_amount: capturedPayment.amount,
            reason: `Reconciliation engine synchronized order "${order.id}" status to "paid" matching captured payment "${capturedPayment.id}".`,
            order_id: order.id,
            payment_id: capturedPayment.id,
            result: 'success',
          });

          report.reconciledCount++;
          report.actionsTaken.push({
            orderId: order.id,
            razorpayOrderId: order.razorpay_order_id || undefined,
            action: 'ORDER_STATUS_REPAIRED_TO_PAID',
            detail: `Synced order status to paid matching captured payment ${capturedPayment.id}`,
          });
        }

        // Case 2: Order is marked 'paid' but has zero payment records
        if (order.status === 'paid' && payments.length === 0) {
          report.discrepanciesCount++;
          report.actionsTaken.push({
            orderId: order.id,
            razorpayOrderId: order.razorpay_order_id || undefined,
            action: 'ORPHANED_PAID_ORDER_FLAGGED',
            detail: `Order ${order.id} is marked paid but has no corresponding payment transaction record in the ledger.`,
          });
        }
      }

      return report;
    } catch (err: any) {
      console.error('[ReconciliationService] Reconciliation error:', err);
      return report;
    }
  }

  /**
   * Starts periodic background reconciliation worker.
   */
  public start(intervalMs: number = 10 * 60 * 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        const report = await this.reconcile();
        if (report.reconciledCount > 0 || report.discrepanciesCount > 0) {
          console.log(`[Reconciliation] Pass complete: ${report.reconciledCount} reconciled, ${report.discrepanciesCount} discrepancies.`);
        }
      } catch (err) {
        console.error('[Reconciliation] Background worker error:', err);
      }
    }, intervalMs);

    console.log(`[Reconciliation] Worker initialized (interval: ${intervalMs / 1000}s).`);
  }

  /**
   * Stops background reconciliation worker.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

export const reconciliationService = new PaymentReconciliationService();
