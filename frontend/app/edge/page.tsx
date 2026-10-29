"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  Radio,
  Cpu,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Truck,
  Layers,
  ArrowRight
} from "lucide-react";
import TFTMirror from "@/components/TFTMirror";
import {
  fetchResources,
  fetchResourceWorkOrders,
  createResourceWorkOrder,
  commitResourceWorkOrder,
  quarantineResourceWorkOrder
} from "@/lib/api";
import { ResourceItem, ResourceWorkOrder } from "@/lib/types";

export default function EdgePage() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [workOrders, setWorkOrders] = useState<ResourceWorkOrder[]>([]);
  const [edgeEvents, setEdgeEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Form states for work order creation and commitment
  const [selectedResourceId, setSelectedResourceId] = useState<string>("RES-CHASSIS-40-01");
  const [custodianUserId, setCustodianUserId] = useState<string>("USR-MGR");
  const [commitChallenge, setCommitChallenge] = useState<string>("");
  const [quarantineNotes, setQuarantineNotes] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [resData, woData] = await Promise.allSettled([
        fetchResources(),
        fetchResourceWorkOrders()
      ]);
      if (resData.status === "fulfilled") setResources(resData.value);
      if (woData.status === "fulfilled") {
        setWorkOrders(woData.value);
        // Pre-fill challenge for pending work order if any
        const pending = woData.value.find((w: any) => w.status === "TAG_OBSERVED" || w.status === "PENDING_SCAN");
        if (pending && !commitChallenge) {
          setCommitChallenge(pending.auth_challenge);
        }
      }

      fetch("http://localhost:8000/api/v1/edge/LIRA-EDGE-01/events")
        .then((r) => r.json())
        .then((d) => setEdgeEvents(d.items || []))
        .catch(() => {});
    } catch (e) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3500);
    return () => clearInterval(interval);
  }, []);

  const activeWO = workOrders.find(
    (w) => w.status === "TAG_OBSERVED" || w.status === "PENDING_SCAN"
  );

  const handleCreateWorkOrder = async () => {
    try {
      setCommitting(true);
      setActionFeedback("CREATING WORK ORDER & PROMPTING TFT...");
      const res = await createResourceWorkOrder({
        resource_id: selectedResourceId,
        incident_id: "INC-C102",
        plan_id: "PLAN-A",
        plan_version: 1,
        custodian_user_id: custodianUserId,
        target_device_id: "LIRA-EDGE-01"
      });
      setCommitChallenge(res.auth_challenge);
      setActionFeedback(`WORK ORDER CREATED: ${res.work_order_id}. Challenge ${res.auth_challenge} prompt sent to TFT screen.`);
      await loadData();
    } catch (e: any) {
      setActionFeedback(`ERROR: ${e?.message || "Failed to create work order"}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleConfirmCheckoutWeb = async () => {
    if (!activeWO) return;
    try {
      setCommitting(true);
      setActionFeedback("ATOMICALLY VERIFYING CHALLENGE & LEASE LOCK...");
      const res = await commitResourceWorkOrder(activeWO.work_order_id, {
        auth_challenge: commitChallenge || activeWO.auth_challenge,
        operator_user_id: custodianUserId,
        notes: "Chassis physically inspected and confirmed by Port Operations Manager."
      });
      setActionFeedback(`CHECKOUT COMMITTED! Tx: ${res.transaction_id} | Lease: ${res.lease_id}. Resource locked.`);
      await loadData();
    } catch (e: any) {
      setActionFeedback(`ERROR: ${e?.message || "Commitment failed"}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleQuarantine = async () => {
    if (!activeWO) return;
    try {
      setCommitting(true);
      setActionFeedback("QUARANTINING RESOURCE & REVOKING TAG...");
      const notes = quarantineNotes || "Damaged twistlock reported during pre-trip inspection";
      const res = await quarantineResourceWorkOrder(activeWO.work_order_id, {
        defect_notes: notes,
        inspector_id: custodianUserId
      });
      setActionFeedback(`RESOURCE QUARANTINED: ${res.resource_id} locked. Inspection record: ${res.inspection_id}`);
      await loadData();
    } catch (e: any) {
      setActionFeedback(`ERROR: ${e?.message || "Quarantine action failed"}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222936] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[#F0F4F8] font-mono tracking-tight flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-[#0284C7]" />
            <span>ResourceLock Cyber-Physical Operations</span>
            <span className="text-[10px] bg-[#0284C7]/10 text-[#0284C7] px-2 py-0.5 rounded-sm border border-[#0284C7]/30 font-bold">
              PRD v9 BUTTONLESS
            </span>
          </h1>
          <p className="text-[#8A99AD] text-xs font-mono mt-1">
            Pre-Gate Hardware Staging & Web-Gated Custodian Authorization. Physical scan generates evidence only; all checkout mutations committed on Web Control Tower.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10141B] hover:bg-[#161B24] border border-[#222936] text-xs font-mono text-[#F0F4F8] rounded-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: TFT Mirror & Decision Capsule (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <TFTMirror />
        </div>

        {/* Right Column: Web Custodian Authorization & Resource Registry (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Work Order Action Panel */}
          <div className="bg-[#10141B] border border-[#222936] rounded-sm p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#222936] pb-2">
              <div className="flex items-center gap-2 text-[#0284C7] font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>WEB CUSTODIAN AUTHORIZATION GATEWAY</span>
              </div>
              <span className="text-[10px] text-[#8A99AD]">
                LOGGED IN: <strong className="text-[#F0F4F8]">{custodianUserId}</strong> (PORT LOGISTICS DIRECTOR)
              </span>
            </div>

            {activeWO ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#090B0E] p-3 border border-[#222936] rounded-sm">
                  <div>
                    <span className="text-[#8A99AD] block text-[10px]">WORK ORDER ID:</span>
                    <span className="text-[#0284C7] font-bold">{activeWO.work_order_id}</span>
                  </div>
                  <div>
                    <span className="text-[#8A99AD] block text-[10px]">RESOURCE / ASSET:</span>
                    <span className="text-[#F0F4F8] font-bold">{activeWO.resource_id}</span>
                  </div>
                  <div>
                    <span className="text-[#8A99AD] block text-[10px]">TARGET TERMINAL:</span>
                    <span className="text-[#F0F4F8]">{activeWO.target_device_id}</span>
                  </div>
                  <div>
                    <span className="text-[#8A99AD] block text-[10px]">CURRENT STATUS:</span>
                    <span
                      className={`font-bold ${
                        activeWO.status === "TAG_OBSERVED" ? "text-[#16A34A] animate-pulse" : "text-[#D97706]"
                      }`}
                    >
                      {activeWO.status === "TAG_OBSERVED"
                        ? "TAG OBSERVED // AWAITING WEB CONFIRMATION"
                        : "PENDING PHYSICAL RC522 SCAN"}
                    </span>
                  </div>
                </div>

                {/* Challenge input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8A99AD] block">
                    AUTHORIZATION CHALLENGE TOKEN (SHORT-LIVED):
                  </label>
                  <input
                    type="text"
                    value={commitChallenge}
                    onChange={(e) => setCommitChallenge(e.target.value)}
                    placeholder="Enter challenge token e.g. CHAL-89B102"
                    className="w-full bg-[#090B0E] border border-[#222936] px-2.5 py-1.5 text-xs text-[#F0F4F8] rounded-sm font-mono focus:outline-none focus:border-[#0284C7]"
                  />
                </div>

                {/* Web Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleConfirmCheckoutWeb}
                    disabled={committing || activeWO.status !== "TAG_OBSERVED"}
                    className={`py-2 px-3 text-xs font-bold font-mono rounded-sm flex items-center justify-center gap-1.5 transition-colors ${
                      activeWO.status === "TAG_OBSERVED"
                        ? "bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer"
                        : "bg-[#161B24] text-[#8A99AD] border border-[#222936] cursor-not-allowed"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>CONFIRM CHECKOUT ON WEBSITE</span>
                  </button>

                  <button
                    onClick={handleQuarantine}
                    disabled={committing}
                    className="py-2 px-3 text-xs font-bold font-mono bg-[#DC2626]/20 hover:bg-[#DC2626]/30 text-[#DC2626] border border-[#DC2626]/40 rounded-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>INSPECTION FAILED (QUARANTINE)</span>
                  </button>
                </div>

                {activeWO.status !== "TAG_OBSERVED" && (
                  <p className="text-[10px] text-[#D97706] bg-[#D97706]/10 p-2 border border-[#D97706]/20 rounded-sm">
                    ℹ Present physical RFID tag at ESP32 RC522 scanner. Checkout button enables once hardware event <code>SCAN_OBSERVED</code> is registered.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[#8A99AD]">
                  No active work order pending for terminal <code>LIRA-EDGE-01</code>. Select an available resource below to initiate a web-authorized work order:
                </p>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedResourceId}
                    onChange={(e) => setSelectedResourceId(e.target.value)}
                    className="bg-[#090B0E] border border-[#222936] text-[#F0F4F8] px-2.5 py-1.5 text-xs font-mono rounded-sm flex-1 focus:outline-none focus:border-[#0284C7]"
                  >
                    {resources
                      .filter((r) => r.status === "INSPECTED_AVAILABLE")
                      .map((r) => (
                        <option key={r.resource_id} value={r.resource_id}>
                          {r.resource_id} — {r.name} ({r.resource_type})
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={handleCreateWorkOrder}
                    disabled={committing}
                    className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold font-mono text-xs rounded-sm transition-colors whitespace-nowrap"
                  >
                    ISSUE WORK ORDER
                  </button>
                </div>
              </div>
            )}

            {actionFeedback && (
              <div className="p-2.5 bg-[#161B24] border border-[#222936] text-[10px] text-[#F0F4F8] rounded-sm font-mono leading-relaxed">
                {actionFeedback}
              </div>
            )}
          </div>

          {/* Resource Registry Table */}
          <div className="bg-[#10141B] border border-[#222936] rounded-sm p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#222936] pb-2">
              <div className="flex items-center gap-2 text-[#F0F4F8] font-bold">
                <Truck className="w-4 h-4 text-[#D97706]" />
                <span>RESOURCE REGISTRY & LEASE INVENTORY</span>
              </div>
              <span className="text-[10px] text-[#8A99AD]">{resources.length} MANAGED ASSETS</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[#8A99AD] border-b border-[#222936] text-[10px]">
                    <th className="pb-1.5 font-semibold">RESOURCE ID</th>
                    <th className="pb-1.5 font-semibold">NAME & SPECS</th>
                    <th className="pb-1.5 font-semibold">RFID TAG</th>
                    <th className="pb-1.5 font-semibold">STATUS</th>
                    <th className="pb-1.5 font-semibold">HOLDER / LEASE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222936]/60">
                  {resources.map((res) => (
                    <tr key={res.resource_id} className="hover:bg-[#161B24]/50 transition-colors">
                      <td className="py-2 text-[#0284C7] font-bold">{res.resource_id}</td>
                      <td className="py-2 text-[#F0F4F8]">
                        <div>{res.name}</div>
                        <span className="text-[9px] text-[#8A99AD]">{res.resource_type} // Ver: {res.version}</span>
                      </td>
                      <td className="py-2 font-mono text-[#D97706] font-semibold">{res.tag_ref}</td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-sm border ${
                            res.status === "INSPECTED_AVAILABLE"
                              ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                              : res.status === "CHECKED_OUT"
                              ? "bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/30"
                              : res.status === "QUARANTINED"
                              ? "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30"
                              : "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30"
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="py-2 text-[10px] text-[#8A99AD]">
                        {res.current_holder_id ? (
                          <div>
                            <span className="text-[#F0F4F8] font-semibold">{res.current_holder_id}</span>
                            <span className="block text-[9px] text-[#0284C7]">{res.current_lease_id || "ACTIVE"}</span>
                          </div>
                        ) : (
                          <span>UNASSIGNED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Security & Hardware Separation Architecture */}
          <div className="bg-[#10141B] border border-[#222936] rounded-sm p-4 font-mono text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-[#0284C7] font-bold border-b border-[#222936] pb-2">
              <KeyRound className="w-3.5 h-3.5" />
              <span>v9 BUTTONLESS HARDWARE SECURITY CONTRACT</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-[#8A99AD] leading-relaxed">
              <div className="space-y-1">
                <span className="text-[#F0F4F8] font-bold block">1. Physical Evidence Separation:</span>
                RC522 13.56MHz scan registers physical tag presence only (<code>SCAN_OBSERVED</code>). It does not authenticate the human custodian, open gates, or execute dispatch.
              </div>
              <div className="space-y-1">
                <span className="text-[#F0F4F8] font-bold block">2. Web Authorization Gate:</span>
                Custodian authentication, challenge verification (<code>CHAL-*</code>), and double-checkout prevention occur atomically on the Web Control Tower database.
              </div>
              <div className="space-y-1">
                <span className="text-[#F0F4F8] font-bold block">3. QpiAI Decision Capsule:</span>
                Signed, expiring capsule pre-computed server-side and cached in ESP32 Core 1 RAM to display alternative previews and warnings offline.
              </div>
              <div className="space-y-1">
                <span className="text-[#F0F4F8] font-bold block">4. Monotonic Sequence Verification:</span>
                Monotonic packet sequence counter rejects duplicate or replayed RFID event transmissions immediately with <code>OUT_OF_SEQUENCE_REJECTED</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
