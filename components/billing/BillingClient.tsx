"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, DollarSign, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billSchema, paymentSchema, BillInput, PaymentInput } from "@/lib/validations";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [{ value: "", label: "All" }, { value: "ISSUED", label: "Issued" }, { value: "PAID", label: "Paid" }, { value: "PARTIALLY_PAID", label: "Partial" }];
const CATEGORIES = ["CONSULTATION", "LAB", "MEDICINE", "ADMISSION", "OTHER"].map(c => ({ value: c, label: c }));

export function BillingClient() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const qc = useQueryClient();

  const role = session?.user?.role as string;
  const isAccountant = ["ADMIN", "ACCOUNTANT"].includes(role);

  const { data, isLoading } = useQuery({
    queryKey: ["bills", status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/billing?${params}`);
      return res.json();
    },
  });

  const { data: patientData } = useQuery({ queryKey: ["patients-list"], queryFn: async () => { const res = await fetch("/api/patients?limit=100"); return res.json(); }, enabled: isAccountant });

  const billForm = useForm<BillInput>({
    resolver: zodResolver(billSchema),
    defaultValues: { patientId: "", items: [{ description: "", category: "CONSULTATION", quantity: 1, unitPrice: 0 }], tax: 0, discount: 0 },
  });
  const { fields, append, remove } = useFieldArray({ control: billForm.control, name: "items" });

  const payForm = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema) });

  const createBillMutation = useMutation({
    mutationFn: async (data: BillInput) => {
      const res = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Bill created"); qc.invalidateQueries({ queryKey: ["bills"] }); setCreateModal(false); billForm.reset(); },
    onError: () => toast.error("Failed"),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PaymentInput }) => {
      const res = await fetch(`/api/billing/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (result) => { toast.success(`Payment recorded — Bill ${result.status}`); qc.invalidateQueries({ queryKey: ["bills"] }); setPayModal(null); payForm.reset(); },
    onError: () => toast.error("Failed"),
  });

  const patientOptions = patientData?.patients?.map((p: any) => ({ value: p.id, label: p.name })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" />
        {isAccountant && <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateModal(true)}>Create Bill</Button>}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-6"><TableSkeleton rows={8} cols={6} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Items</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Paid</th>
                  <th className="table-header">Balance</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.bills?.length === 0 && (
                  <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">
                    <div className="flex flex-col items-center gap-2"><Receipt className="w-8 h-8 text-gray-200" />No bills found</div>
                  </td></tr>
                )}
                {data?.bills?.map((bill: any) => {
                  const paid = bill.payments?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0;
                  const balance = bill.total - paid;
                  return (
                    <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{bill.patient?.name}</td>
                      <td className="table-cell text-gray-500">{bill.items?.length} item(s)</td>
                      <td className="table-cell font-semibold">{formatCurrency(bill.total)}</td>
                      <td className="table-cell text-green-600">{formatCurrency(paid)}</td>
                      <td className="table-cell text-red-600 font-medium">{formatCurrency(balance)}</td>
                      <td className="table-cell"><StatusBadge status={bill.status} /></td>
                      <td className="table-cell text-gray-500">{formatDate(bill.createdAt)}</td>
                      <td className="table-cell">
                        {isAccountant && bill.status !== "PAID" && bill.status !== "CANCELLED" && (
                          <button onClick={() => { setPayModal(bill); payForm.setValue("billId", bill.id); }} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                            <DollarSign className="w-3.5 h-3.5" />Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="px-6 py-4 border-t border-gray-100"><Pagination page={page} total={data.total} limit={15} onPageChange={setPage} /></div>}
      </motion.div>

      {/* Create Bill Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); billForm.reset(); }} title="Create Bill" size="xl">
        <form onSubmit={billForm.handleSubmit((d) => createBillMutation.mutate(d))} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Select label="Patient" options={patientOptions} placeholder="Select patient" error={billForm.formState.errors.patientId?.message} {...billForm.register("patientId")} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Bill Items</label>
              <button type="button" onClick={() => append({ description: "", category: "CONSULTATION", quantity: 1, unitPrice: 0 })} className="text-xs text-blue-600 hover:underline font-medium">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-5 gap-2 p-3 bg-gray-50 rounded-xl items-end">
                  <div className="col-span-2"><Input placeholder="Description" {...billForm.register(`items.${i}.description`)} /></div>
                  <Select options={CATEGORIES} {...billForm.register(`items.${i}.category`)} />
                  <Input type="number" placeholder="Qty" {...billForm.register(`items.${i}.quantity`)} />
                  <div className="flex gap-1 items-end">
                    <Input type="number" placeholder="Unit Price" {...billForm.register(`items.${i}.unitPrice`)} />
                    {fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 pb-2 text-lg leading-none">×</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tax (%)" type="number" placeholder="0" {...billForm.register("tax")} />
            <Input label="Discount ($)" type="number" placeholder="0" {...billForm.register("discount")} />
          </div>
          <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} {...billForm.register("notes")} /></div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" type="button" onClick={() => { setCreateModal(false); billForm.reset(); }}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={createBillMutation.isPending}>Create Bill</Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Payment" size="sm">
        {payModal && (
          <form onSubmit={payForm.handleSubmit((d) => payMutation.mutate({ id: payModal.id, data: d }))} className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-900">{payModal.patient?.name}</p>
              <p className="text-sm text-gray-600">Total: {formatCurrency(payModal.total)}</p>
              <p className="text-sm text-red-600">Balance: {formatCurrency(payModal.total - (payModal.payments?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0))}</p>
            </div>
            <Input label="Amount ($)" type="number" step="0.01" error={payForm.formState.errors.amount?.message} {...payForm.register("amount")} />
            <Select label="Payment Method" options={[{ value: "CASH", label: "Cash" }, { value: "CARD", label: "Card" }, { value: "INSURANCE", label: "Insurance" }, { value: "BANK_TRANSFER", label: "Bank Transfer" }]} {...payForm.register("method")} />
            <Input label="Reference (optional)" placeholder="Transaction ID" {...payForm.register("reference")} />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" type="button" onClick={() => setPayModal(null)}>Cancel</Button>
              <Button className="flex-1" type="submit" loading={payMutation.isPending}>Record Payment</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
