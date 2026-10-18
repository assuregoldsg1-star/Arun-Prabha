// Supabase Edge Function: notify-customer
// Sends a push notification to the owner's devices when a customer submits their details.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { customer_id } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await sb.from("customers").select("id,full_name,created_at").eq("id", customer_id).single();
    // only for genuine, brand-new customers (stops anyone replaying the call)
    if (!c || Date.now() - new Date(c.created_at).getTime() > 5 * 60 * 1000) return new Response("ignored");
    webpush.setVapidDetails("mailto:assuregoldsg1@gmail.com", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
    const { data: subs } = await sb.from("push_subscriptions").select("*");
    const name = (c.full_name || "A customer").trim();
    const payload = JSON.stringify({
      title: "New customer details",
      body: name + " has submitted their details. Tap to log a transaction.",
      url: "/portal.html?log=" + c.id,
      tag: "cust-" + c.id,
    });
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }));
    return new Response("ok");
  } catch (e) {
    return new Response("error: " + e.message, { status: 500 });
  }
});
