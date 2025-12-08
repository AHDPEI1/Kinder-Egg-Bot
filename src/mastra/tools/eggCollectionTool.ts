import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const FIGURES = [
  "Дастин", "Дастин из изнанки",
  "Майк",
  "Уилл", "Уилл из изнанки",
  "Лукас",
  "Макс",
  "Оди из лаборатории",
  "Оди из изнанки",
  "Оди в лабораторном халате",
  "Демогргон на карандаш",
  "Демогоргон-брелок", "Демогоргон-брелок на скрепке",
  "Стив", "Стив из изнанки",
  "Векна",
  "Эрика",
  "Хоппер", "Хоппер из изнанки",
  "Нэнси",
  "Робин из изнанки",
  "Эдди из изнанки",
  "Макс из изнанки",
  "Связанные Стив и Робин"
];

function calculateProbabilities(): number[] {
  const total = FIGURES.length;
  const pWill = 0.005;
  const pWillDark = 0.01;
  const remaining = total - 2;
  const pOther = (1 - pWill - pWillDark) / remaining;
  
  return FIGURES.map(f => {
    if (f === "Уилл") return pWill;
    if (f === "Уилл из изнанки") return pWillDark;
    return pOther;
  });
}

function weightedRandomChoice(items: string[], weights: number[]): string {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

const userGameState: Map<string, { eggs: number[], collection: string[] }> = new Map();

export const startGameTool = createTool({
  id: "start-game",
  description: "Starts a new Kinder Egg collection game for the user. Call this when user sends /start command or wants to start a new game.",
  
  inputSchema: z.object({
    userName: z.string().describe("The Telegram username of the player"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    availableEggs: z.array(z.number()),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎮 [startGameTool] Starting new game for user:", context.userName);
    
    const eggs = Array.from({ length: 24 }, (_, i) => i + 1);
    userGameState.set(context.userName, { eggs, collection: [] });
    
    logger?.info("✅ [startGameTool] Game initialized with 24 eggs");
    
    return {
      success: true,
      message: "🥚 Игра началась! У тебя 24 яйца. Выбери яйцо: напиши число от 1 до 24.",
      availableEggs: eggs,
    };
  },
});

export const openEggTool = createTool({
  id: "open-egg",
  description: "Opens a specific egg number and reveals what figure the user got. Call this when user sends a number between 1-24.",
  
  inputSchema: z.object({
    userName: z.string().describe("The Telegram username of the player"),
    eggNumber: z.number().describe("The egg number to open (1-24)"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    figure: z.string().optional(),
    collection: z.array(z.object({
      name: z.string(),
      count: z.number(),
    })).optional(),
    remainingEggs: z.number().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [openEggTool] Opening egg:", { userName: context.userName, eggNumber: context.eggNumber });
    
    const gameState = userGameState.get(context.userName);
    
    if (!gameState) {
      logger?.info("❌ [openEggTool] No game found for user");
      return {
        success: false,
        message: "Игра не найдена! Напиши /start чтобы начать новую игру.",
      };
    }
    
    if (context.eggNumber < 1 || context.eggNumber > 24) {
      logger?.info("❌ [openEggTool] Invalid egg number");
      return {
        success: false,
        message: "Введи число от 1 до 24!",
      };
    }
    
    if (!gameState.eggs.includes(context.eggNumber)) {
      logger?.info("❌ [openEggTool] Egg already opened");
      return {
        success: false,
        message: "Это яйцо уже открыто. Выбери другое!",
      };
    }
    
    gameState.eggs = gameState.eggs.filter(e => e !== context.eggNumber);
    
    const probabilities = calculateProbabilities();
    const figure = weightedRandomChoice(FIGURES, probabilities);
    
    gameState.collection.push(figure);
    userGameState.set(context.userName, gameState);
    
    logger?.info("✅ [openEggTool] Egg opened, got figure:", figure);
    
    const collectionCount: Record<string, number> = {};
    for (const item of gameState.collection) {
      collectionCount[item] = (collectionCount[item] || 0) + 1;
    }
    
    const collection = Object.entries(collectionCount).map(([name, count]) => ({ name, count }));
    
    const collectionText = collection.map(c => `${c.name}: ${c.count}`).join("\n");
    
    let message = `🥚 Ты открыл яйцо №${context.eggNumber}!\n\n🎁 Тебе выпала: *${figure}*!\n\n📦 *Твоя коллекция:*\n${collectionText}`;
    
    if (gameState.eggs.length === 0) {
      message += "\n\n🎉 Поздравляю! Ты открыл все яйца! Напиши /start чтобы начать заново.";
    } else {
      message += `\n\n🥚 Осталось яиц: ${gameState.eggs.length}`;
    }
    
    return {
      success: true,
      message,
      figure,
      collection,
      remainingEggs: gameState.eggs.length,
    };
  },
});

export const getCollectionTool = createTool({
  id: "get-collection",
  description: "Gets the current collection of figures for a user. Call this when user asks about their collection.",
  
  inputSchema: z.object({
    userName: z.string().describe("The Telegram username of the player"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    collection: z.array(z.object({
      name: z.string(),
      count: z.number(),
    })).optional(),
    remainingEggs: z.number().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📦 [getCollectionTool] Getting collection for user:", context.userName);
    
    const gameState = userGameState.get(context.userName);
    
    if (!gameState) {
      return {
        success: false,
        message: "Игра не найдена! Напиши /start чтобы начать новую игру.",
      };
    }
    
    if (gameState.collection.length === 0) {
      return {
        success: true,
        message: "Твоя коллекция пуста. Выбери яйцо (1-24) чтобы начать собирать фигурки!",
        collection: [],
        remainingEggs: gameState.eggs.length,
      };
    }
    
    const collectionCount: Record<string, number> = {};
    for (const item of gameState.collection) {
      collectionCount[item] = (collectionCount[item] || 0) + 1;
    }
    
    const collection = Object.entries(collectionCount).map(([name, count]) => ({ name, count }));
    const collectionText = collection.map(c => `${c.name}: ${c.count}`).join("\n");
    
    logger?.info("✅ [getCollectionTool] Collection retrieved:", collection);
    
    return {
      success: true,
      message: `📦 *Твоя коллекция:*\n${collectionText}\n\n🥚 Осталось яиц: ${gameState.eggs.length}`,
      collection,
      remainingEggs: gameState.eggs.length,
    };
  },
});
