import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { kinderEggAgent } from "../agents/kinderEggAgent";

const processWithAgent = createStep({
  id: "process-with-agent",
  description: "Processes the Telegram message using the Kinder Egg game agent",

  inputSchema: z.object({
    userName: z.string().describe("Telegram username"),
    telegramId: z.number().describe("Telegram user ID"),
    message: z.string().describe("User message"),
    chatId: z.number().describe("Telegram chat ID"),
  }),

  outputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🚀 [Step 1] Processing message with agent...", {
      userName: inputData.userName,
      telegramId: inputData.telegramId,
      message: inputData.message,
    });

    const response = await kinderEggAgent.generateLegacy(
      [{ role: "user", content: `telegramId: ${inputData.telegramId}\nuserName: ${inputData.userName}\nСообщение: ${inputData.message}` }],
      {
        resourceId: String(inputData.telegramId),
        threadId: `telegram-${inputData.telegramId}`,
        maxSteps: 5,
      }
    );

    logger?.info("✅ [Step 1] Agent response received:", response.text);

    return {
      agentResponse: response.text,
      chatId: inputData.chatId,
    };
  },
});

const sendToTelegram = createStep({
  id: "send-to-telegram",
  description: "Sends the agent response back to Telegram",

  inputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [Step 2] Sending response to Telegram...", {
      chatId: inputData.chatId,
      responseLength: inputData.agentResponse.length,
    });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger?.error("❌ [Step 2] TELEGRAM_BOT_TOKEN not found");
      return {
        success: false,
        message: "Telegram bot token not configured",
      };
    }

    try {
      let textMessage = inputData.agentResponse;
      let imageUrl: string | null = null;
      
      const imageMatch = inputData.agentResponse.match(/\[IMAGE:(.*?)\]/);
      if (imageMatch) {
        imageUrl = imageMatch[1];
        textMessage = inputData.agentResponse.replace(/\[IMAGE:.*?\]/, "").trim();
      }
      
      if (!imageUrl) {
        const markdownMatch = inputData.agentResponse.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
        if (markdownMatch) {
          imageUrl = markdownMatch[1];
          textMessage = inputData.agentResponse.replace(/!\[.*?\]\(https?:\/\/[^\)]+\)/, "").trim();
        }
      }
      
      if (imageUrl) {
        logger?.info("📷 [Step 2] Sending photo to Telegram...", { imageUrl });
        const photoResponse = await fetch(
          `https://api.telegram.org/bot${token}/sendPhoto`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: inputData.chatId,
              photo: imageUrl,
              caption: textMessage,
              parse_mode: "Markdown",
            }),
          }
        );
        
        const photoResult = await photoResponse.json();
        
        if (!photoResult.ok) {
          logger?.warn("⚠️ [Step 2] Photo send failed, falling back to text:", photoResult);
          await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: inputData.chatId,
                text: textMessage,
                parse_mode: "Markdown",
              }),
            }
          );
        }
        
        return {
          success: true,
          message: "Photo sent successfully",
        };
      }
      
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: inputData.chatId,
            text: textMessage,
            parse_mode: "Markdown",
          }),
        }
      );

      const result = await response.json();
      
      if (!result.ok) {
        logger?.error("❌ [Step 2] Telegram API error:", result);
        await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: inputData.chatId,
              text: textMessage,
            }),
          }
        );
      }

      logger?.info("✅ [Step 2] Message sent to Telegram successfully");

      return {
        success: true,
        message: "Message sent successfully",
      };
    } catch (error) {
      logger?.error("❌ [Step 2] Failed to send message:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const kinderEggWorkflow = createWorkflow({
  id: "kinder-egg-workflow",

  inputSchema: z.object({
    userName: z.string().describe("Telegram username"),
    telegramId: z.number().describe("Telegram user ID"),
    message: z.string().describe("User message"),
    chatId: z.number().describe("Telegram chat ID"),
  }) as any,

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(processWithAgent as any)
  .then(sendToTelegram as any)
  .commit();
