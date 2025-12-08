import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const FIGURES: { name: string; imageUrl: string }[] = [
  { name: "Дастин", imageUrl: "https://i.ibb.co/6RQJ3Dn/dustin.png" },
  { name: "Дастин из изнанки", imageUrl: "https://i.ibb.co/7vMQgKN/dustin-upside.png" },
  { name: "Майк", imageUrl: "https://i.ibb.co/3fLqKpR/mike.png" },
  { name: "Уилл", imageUrl: "https://i.ibb.co/Qf9Ld4M/will.png" },
  { name: "Уилл из изнанки", imageUrl: "https://i.ibb.co/Wk4sJRN/will-upside.png" },
  { name: "Лукас", imageUrl: "https://i.ibb.co/xMsRb3Y/lucas.png" },
  { name: "Макс", imageUrl: "https://i.ibb.co/1nKJ2Rq/max.png" },
  { name: "Оди из лаборатории", imageUrl: "https://i.ibb.co/fQkLqMv/eleven-lab.png" },
  { name: "Оди из изнанки", imageUrl: "https://i.ibb.co/9wZGhQf/eleven-upside.png" },
  { name: "Оди в лабораторном халате", imageUrl: "https://i.ibb.co/r7RqXPL/eleven-coat.png" },
  { name: "Демогргон на карандаш", imageUrl: "https://i.ibb.co/CwPQhZ6/demogorgon-pencil.png" },
  { name: "Демогоргон-брелок", imageUrl: "https://i.ibb.co/Hd3v4JN/demogorgon-keychain.png" },
  { name: "Демогоргон-брелок на скрепке", imageUrl: "https://i.ibb.co/vXJ5YLs/demogorgon-clip.png" },
  { name: "Стив", imageUrl: "https://i.ibb.co/LRy9c7K/steve.png" },
  { name: "Стив из изнанки", imageUrl: "https://i.ibb.co/6RJmVhL/steve-upside.png" },
  { name: "Векна", imageUrl: "https://i.ibb.co/q5RLqNm/vecna.png" },
  { name: "Эрика", imageUrl: "https://i.ibb.co/Lz8y4Rn/erica.png" },
  { name: "Хоппер", imageUrl: "https://i.ibb.co/1QVqZ7G/hopper.png" },
  { name: "Хоппер из изнанки", imageUrl: "https://i.ibb.co/2yPGdLk/hopper-upside.png" },
  { name: "Нэнси", imageUrl: "https://i.ibb.co/X8LzNhR/nancy.png" },
  { name: "Робин из изнанки", imageUrl: "https://i.ibb.co/fH9qYZv/robin-upside.png" },
  { name: "Эдди из изнанки", imageUrl: "https://i.ibb.co/VvXLq1N/eddie-upside.png" },
  { name: "Макс из изнанки", imageUrl: "https://i.ibb.co/YTQh7Fd/max-upside.png" },
  { name: "Связанные Стив и Робин", imageUrl: "https://i.ibb.co/3pZLrKq/steve-robin-tied.png" },
];

function calculateProbabilities(): number[] {
  const total = FIGURES.length;
  const pWill = 0.005;
  const pWillDark = 0.01;
  const remaining = total - 2;
  const pOther = (1 - pWill - pWillDark) / remaining;
  
  return FIGURES.map(f => {
    if (f.name === "Уилл") return pWill;
    if (f.name === "Уилл из изнанки") return pWillDark;
    return pOther;
  });
}

function weightedRandomChoice(items: { name: string; imageUrl: string }[], weights: number[]): { name: string; imageUrl: string } {
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
    imageUrl: z.string().optional(),
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
    
    gameState.collection.push(figure.name);
    userGameState.set(context.userName, gameState);
    
    logger?.info("✅ [openEggTool] Egg opened, got figure:", figure.name);
    
    const collectionCount: Record<string, number> = {};
    for (const item of gameState.collection) {
      collectionCount[item] = (collectionCount[item] || 0) + 1;
    }
    
    const collection = Object.entries(collectionCount).map(([name, count]) => ({ name, count }));
    
    const collectionText = collection.map(c => `${c.name}: ${c.count}`).join("\n");
    
    let message = `🥚 Ты открыл яйцо №${context.eggNumber}!\n\n🎁 Тебе выпала: *${figure.name}*!\n\n📦 *Твоя коллекция:*\n${collectionText}`;
    
    if (gameState.eggs.length === 0) {
      message += "\n\n🎉 Поздравляю! Ты открыл все яйца! Напиши /start чтобы начать заново.";
    } else {
      message += `\n\n🥚 Осталось яиц: ${gameState.eggs.length}`;
    }
    
    return {
      success: true,
      message,
      figure: figure.name,
      imageUrl: figure.imageUrl,
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
