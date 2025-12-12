/**
 * Telegram Trigger - Webhook-based Workflow Triggering with Payment Support
 */

import { registerApiRoute } from "../mastra/inngest";
import { Mastra } from "@mastra/core";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(
    "TELEGRAM_BOT_TOKEN not found. Please configure the Telegram integration.",
  );
}

async function setupTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ [Telegram] No bot token, skipping webhook setup");
    return;
  }

  let webhookUrl: string | undefined;
  
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(",")[0];
    webhookUrl = `https://${domain}/api/webhooks/telegram/action`;
  } else if (process.env.CONNECTORS_HOSTNAME) {
    webhookUrl = `https://${process.env.CONNECTORS_HOSTNAME}/api/webhooks/telegram/action`;
  } else if (process.env.REPLIT_CONNECTORS_HOSTNAME) {
    webhookUrl = `https://${process.env.REPLIT_CONNECTORS_HOSTNAME}/api/webhooks/telegram/action`;
  }

  if (!webhookUrl) {
    console.warn("⚠️ [Telegram] No domain found for webhook setup");
    return;
  }

  console.log(`🔗 [Telegram] Setting webhook to: ${webhookUrl}`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "pre_checkout_query"],
      }),
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log("✅ [Telegram] Webhook set successfully");
    } else {
      console.error("❌ [Telegram] Failed to set webhook:", result);
    }
  } catch (error) {
    console.error("❌ [Telegram] Error setting webhook:", error);
  }
}

setupTelegramWebhook();

export type TriggerInfoTelegramOnNewMessage = {
  type: "telegram/message" | "telegram/pre_checkout" | "telegram/payment";
  params: {
    userName: string;
    message: string;
  };
  payload: any;
};

async function answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    }),
  });
}

async function sendInvoice(chatId: number, quantity: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const starsAmount = quantity * 10;
  
  const response = await fetch(`https://api.telegram.org/bot${token}/sendInvoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      title: `🥚 ${quantity} Киндер-яиц`,
      description: `Купить ${quantity} яиц для игры в Киндер-сюрприз. Открывай яйца и собирай фигурки Stranger Things!`,
      payload: JSON.stringify({ quantity, chatId }),
      provider_token: "",
      currency: "XTR",
      prices: [{ label: `${quantity} яиц`, amount: starsAmount }],
    }),
  });
  
  return response.json();
}

export function registerTelegramTrigger({
  triggerType,
  handler,
  paymentHandler,
}: {
  triggerType: string;
  handler: (
    mastra: Mastra,
    triggerInfo: TriggerInfoTelegramOnNewMessage,
  ) => Promise<void>;
  paymentHandler?: (
    mastra: Mastra,
    telegramId: number,
    userName: string,
    starsAmount: number,
    paymentChargeId: string,
    chatId: number,
  ) => Promise<void>;
}) {
  return [
    registerApiRoute("/webhooks/telegram/action", {
      method: "POST",
      handler: async (c) => {
        const mastra = c.get("mastra");
        const logger = mastra.getLogger();
        try {
          const payload = await c.req.json();
          logger?.info("📝 [Telegram] payload", payload);

          if (payload.pre_checkout_query) {
            logger?.info("💳 [Telegram] Pre-checkout query received");
            const preCheckout = payload.pre_checkout_query;
            
            if (preCheckout.currency === "XTR") {
              await answerPreCheckoutQuery(preCheckout.id, true);
              logger?.info("✅ [Telegram] Pre-checkout approved");
            } else {
              await answerPreCheckoutQuery(preCheckout.id, false, "Invalid currency");
              logger?.error("❌ [Telegram] Pre-checkout rejected - invalid currency");
            }
            return c.text("OK", 200);
          }

          if (payload.message?.successful_payment) {
            logger?.info("💰 [Telegram] Successful payment received");
            const payment = payload.message.successful_payment;
            const chatId = payload.message.chat.id;
            const userName = payload.message.from.username || `user_${payload.message.from.id}`;
            const telegramId = payload.message.from.id;
            
            if (paymentHandler) {
              await paymentHandler(
                mastra,
                telegramId,
                userName,
                payment.total_amount,
                payment.telegram_payment_charge_id,
                chatId,
              );
            }
            return c.text("OK", 200);
          }

          if (payload.message?.text) {
            const text = payload.message.text.toLowerCase();
            const chatId = payload.message.chat.id;
            
            if (text.includes("купить") || text.includes("buy")) {
              const quantityMatch = text.match(/(\d+)/);
              const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
              
              logger?.info("🛒 [Telegram] Purchase request, sending invoice", { quantity });
              await sendInvoice(chatId, quantity);
              return c.text("OK", 200);
            }
            
            await handler(mastra, {
              type: triggerType as any,
              params: {
                userName: payload.message.from.username || `user_${payload.message.from.id}`,
                message: payload.message.text,
              },
              payload,
            });
          }

          return c.text("OK", 200);
        } catch (error) {
          logger?.error("Error handling Telegram webhook:", error);
          return c.text("Internal Server Error", 500);
        }
      },
    }),
  ];
}
