"use client";

import { getSupabaseBrowserClient } from "../supabase/client";
import { SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "../supabase/config";

// Client half of the entry fee. Both calls go to edge functions rather than to
// a Next route, because the mobile app calls the very same two — a Next route
// would mean the same rules written twice and drifting apart.
//
// Nothing here names an amount. `challenge-payment-create` reads it from
// events.entry_fee; a client that could send a price is a client that will.

export type QPayBankUrl = {
  name: string;
  description: string;
  link: string;
  logo: string;
};

export type PaymentInvoice = {
  transactionId: string;
  qrText: string;
  qrImage: string;
  qPayShortUrl: string | null;
  urls: QPayBankUrl[];
  amount: number;
  applicationId: string;
  reused?: boolean;
};

export type CreateInvoiceResult =
  | { ok: true; invoice: PaymentInvoice }
  // A challenge with no fee is registered on the spot — there is no invoice to
  // show and nothing to poll.
  | { ok: true; free: true; registrationNo: string | null }
  | { ok: false; message: string; alreadyPaid?: boolean };

async function authHeaders(): Promise<Record<string, string> | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;
  return {
    "Content-Type": "application/json",
    // Both headers: `apikey` is what the functions gateway checks before the
    // request ever reaches the function, `Authorization` is what the function
    // itself reads to identify the caller.
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function createPaymentInvoice(
  eventId: string,
): Promise<CreateInvoiceResult> {
  const headers = await authHeaders();
  if (!headers) {
    return { ok: false, message: "Нэвтрэлт дууссан байна. Дахин нэвтэрнэ үү." };
  }

  try {
    const res = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/challenge-payment-create`,
      { method: "POST", headers, body: JSON.stringify({ eventId }) },
    );
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        message: body?.error ?? "Нэхэмжлэх үүсгэж чадсангүй.",
        alreadyPaid: body?.alreadyPaid === true,
      };
    }

    if (body?.free === true) {
      return { ok: true, free: true, registrationNo: body.registrationNo ?? null };
    }

    return { ok: true, invoice: body as PaymentInvoice };
  } catch (error) {
    console.error("createPaymentInvoice error:", error);
    return {
      ok: false,
      message: "Сүлжээний алдаа. Интернэтээ шалгаад дахин оролдоно уу.",
    };
  }
}

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "expired";

// Force the callback to re-check with QPay, then read our own row back.
//
// There is no separate status endpoint on purpose. The callback is idempotent —
// it does nothing when the invoice is unpaid and refuses to process a paid one
// twice — so pinging it IS the poll, and the authoritative answer is then read
// straight from challenge_payments through the row's own RLS policy. One less
// endpoint to keep in step with the mobile app.
export async function checkPaymentStatus(
  transactionId: string,
): Promise<PaymentStatus> {
  try {
    await fetch(
      `${SUPABASE_FUNCTIONS_URL}/challenge-payment-callback?transactionId=${encodeURIComponent(transactionId)}`,
      { method: "GET", cache: "no-store", headers: { apikey: SUPABASE_ANON_KEY } },
    );
  } catch (error) {
    // A failed ping is not a failed payment — fall through and read the row,
    // which QPay's own callback may already have updated.
    console.error("checkPaymentStatus ping error:", error);
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("challenge_payments")
    .select("status")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error) {
    console.error("checkPaymentStatus read error:", error);
    return "pending";
  }
  return (data?.status as PaymentStatus) ?? "pending";
}
