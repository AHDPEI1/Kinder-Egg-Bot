import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pg from "pg";

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
  const willProb = 0.005;
  const willUpsideProb = 0.01;
  const remainingProb = 1 - willProb - willUpsideProb;
  const otherCount = FIGURES.length - 2;
  const otherProb = remainingProb / otherCount;
  
  return FIGURES.map(f => {
    if (f.name === "Уилл") return willProb;
    if (f.name === "Уилл из изнанки") return willUpsideProb;
    return otherProb;
  });
}

function weightedRandomChoice(): { name: string; imageUrl: string } {
  const weights = calculateProbabilities();
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < FIGURES.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return { name: FIGURES[i].name, imageUrl: FIGURES[i].imageUrl };
    }
  }
  return { name: FIGURES[FIGURES.length - 1].name, imageUrl: FIGURES[FIGURES.length - 1].imageUrl };
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kinder_users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      free_eggs_remaining INTEGER DEFAULT 5,
      paid_eggs_balance INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kinder_collections (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      figure_name TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(telegram_id, figure_name)
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kinder_payments (
      id SERIAL PRIMARY KEY,
      telegram_payment_charge_id TEXT UNIQUE,
      telegram_id BIGINT NOT NULL,
      stars_amount INTEGER NOT NULL,
      eggs_purchased INTEGER NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

initDatabase().catch(console.error);

async function getOrCreateUser(telegramId: number, username: string) {
  const result = await pool.query(
    `INSERT INTO kinder_users (telegram_id, username, free_eggs_remaining, paid_eggs_balance) 
     VALUES ($1, $2, 5, 0) 
     ON CONFLICT (telegram_id) DO UPDATE SET username = $2, updated_at = NOW()
     RETURNING *`,
    [telegramId, username]
  );
  return result.rows[0];
}

async function getUserCollection(telegramId: number) {
  const result = await pool.query(
    `SELECT figure_name, count FROM kinder_collections WHERE telegram_id = $1 ORDER BY count DESC`,
    [telegramId]
  );
  return result.rows;
}

async function addFigureToCollection(telegramId: number, figureName: string) {
  await pool.query(
    `INSERT INTO kinder_collections (telegram_id, figure_name, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (telegram_id, figure_name) DO UPDATE SET count = kinder_collections.count + 1, updated_at = NOW()`,
    [telegramId, figureName]
  );
}

export const startGameTool = createTool({
  id: "start-game",
  description: "Shows user their egg balance and collection status. Call this when user sends /start command.",
  
  inputSchema: z.object({
    telegramId: z.number().describe("The Telegram user ID"),
    userName: z.string().describe("The Telegram username"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    freeEggs: z.number(),
    paidEggs: z.number(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🎮 [startGameTool] Starting for user:", context);
    
    const user = await getOrCreateUser(context.telegramId, context.userName);
    const collection = await getUserCollection(context.telegramId);
    
    const totalEggs = user.free_eggs_remaining + user.paid_eggs_balance;
    
    let message = `🥚 *Добро пожаловать в Киндер-сюрприз!*\n\n`;
    message += `📊 *Твой баланс:*\n`;
    message += `• Бесплатных яиц: ${user.free_eggs_remaining}\n`;
    message += `• Купленных яиц: ${user.paid_eggs_balance}\n`;
    message += `• Всего: ${totalEggs} яиц\n\n`;
    
    if (collection.length > 0) {
      message += `📦 *Твоя коллекция:*\n`;
      message += collection.map((c: any) => `${c.figure_name}: ${c.count}`).join("\n");
      message += "\n\n";
    }
    
    if (totalEggs > 0) {
      message += `🎁 Напиши "открыть" чтобы открыть яйцо!`;
    } else {
      message += `💫 У тебя закончились яйца. Напиши "купить" чтобы приобрести ещё за Telegram Stars!`;
    }
    
    return {
      success: true,
      message,
      freeEggs: user.free_eggs_remaining,
      paidEggs: user.paid_eggs_balance,
    };
  },
});

export const openEggTool = createTool({
  id: "open-egg",
  description: "Opens one egg and reveals what figure the user got. Call this when user wants to open an egg.",
  
  inputSchema: z.object({
    telegramId: z.number().describe("The Telegram user ID"),
    userName: z.string().describe("The Telegram username"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    figure: z.string().optional(),
    imageUrl: z.string().optional(),
    freeEggs: z.number().optional(),
    paidEggs: z.number().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [openEggTool] Opening egg for:", context);
    
    const user = await getOrCreateUser(context.telegramId, context.userName);
    const totalEggs = user.free_eggs_remaining + user.paid_eggs_balance;
    
    if (totalEggs <= 0) {
      logger?.info("❌ [openEggTool] No eggs available");
      return {
        success: false,
        message: "❌ У тебя нет яиц! Напиши 'купить' чтобы приобрести яйца за Telegram Stars (10 ⭐ = 1 яйцо).",
        freeEggs: 0,
        paidEggs: 0,
      };
    }
    
    if (user.free_eggs_remaining > 0) {
      await pool.query(
        `UPDATE kinder_users SET free_eggs_remaining = free_eggs_remaining - 1, updated_at = NOW() WHERE telegram_id = $1`,
        [context.telegramId]
      );
    } else {
      await pool.query(
        `UPDATE kinder_users SET paid_eggs_balance = paid_eggs_balance - 1, updated_at = NOW() WHERE telegram_id = $1`,
        [context.telegramId]
      );
    }
    
    const figure = weightedRandomChoice();
    await addFigureToCollection(context.telegramId, figure.name);
    
    const updatedUser = await getOrCreateUser(context.telegramId, context.userName);
    const collection = await getUserCollection(context.telegramId);
    
    logger?.info("✅ [openEggTool] Egg opened, got figure:", figure.name);
    
    const collectionText = collection.map((c: any) => `${c.figure_name}: ${c.count}`).join("\n");
    const remainingTotal = updatedUser.free_eggs_remaining + updatedUser.paid_eggs_balance;
    
    let message = `🥚 *Ты открыл яйцо!*\n\n`;
    message += `🎁 Тебе выпала: *${figure.name}*!\n\n`;
    message += `📦 *Твоя коллекция:*\n${collectionText}\n\n`;
    message += `🥚 Осталось яиц: ${remainingTotal} (бесплатных: ${updatedUser.free_eggs_remaining}, купленных: ${updatedUser.paid_eggs_balance})`;
    
    if (remainingTotal === 0) {
      message += `\n\n💫 Яйца закончились! Напиши "купить" для покупки.`;
    }
    
    return {
      success: true,
      message,
      figure: figure.name,
      imageUrl: figure.imageUrl,
      freeEggs: updatedUser.free_eggs_remaining,
      paidEggs: updatedUser.paid_eggs_balance,
    };
  },
});

export const getCollectionTool = createTool({
  id: "get-collection",
  description: "Gets the current collection and egg balance for a user.",
  
  inputSchema: z.object({
    telegramId: z.number().describe("The Telegram user ID"),
    userName: z.string().describe("The Telegram username"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📦 [getCollectionTool] Getting collection for:", context);
    
    const user = await getOrCreateUser(context.telegramId, context.userName);
    const collection = await getUserCollection(context.telegramId);
    
    if (collection.length === 0) {
      return {
        success: true,
        message: "Твоя коллекция пуста. Открой яйцо чтобы получить первую фигурку!",
      };
    }
    
    const collectionText = collection.map((c: any) => `${c.figure_name}: ${c.count}`).join("\n");
    const totalFigures = collection.reduce((sum: number, c: any) => sum + c.count, 0);
    const uniqueFigures = collection.length;
    
    let message = `📦 *Твоя коллекция:*\n${collectionText}\n\n`;
    message += `📊 Всего фигурок: ${totalFigures}\n`;
    message += `🎯 Уникальных: ${uniqueFigures} из ${FIGURES.length}\n\n`;
    message += `🥚 Яиц осталось: ${user.free_eggs_remaining + user.paid_eggs_balance}`;
    
    return {
      success: true,
      message,
    };
  },
});

export const buyEggsTool = createTool({
  id: "buy-eggs",
  description: "Shows purchase info for eggs via Telegram Stars. Call this when user wants to buy eggs.",
  
  inputSchema: z.object({
    telegramId: z.number().describe("The Telegram user ID"),
    userName: z.string().describe("The Telegram username"),
    quantity: z.number().optional().describe("Number of eggs to buy (default 1)"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    const quantity = context.quantity || 1;
    const starsAmount = quantity * 10;
    
    logger?.info("💰 [buyEggsTool] Purchase info requested:", { telegramId: context.telegramId, quantity, starsAmount });
    
    return {
      success: true,
      message: `💫 *Покупка яиц*\n\n🥚 Цена: 10 ⭐ = 1 яйцо\n\nНапиши "купить X" (где X — количество яиц) чтобы купить.\nНапример: "купить 5" = 50 ⭐\n\nОплата происходит через Telegram Stars.`,
    };
  },
});

export const processPaymentTool = createTool({
  id: "process-payment",
  description: "Processes a successful Telegram Stars payment and adds eggs to user balance.",
  
  inputSchema: z.object({
    telegramId: z.number().describe("The Telegram user ID"),
    userName: z.string().describe("The Telegram username"),
    starsAmount: z.number().describe("Amount of stars paid"),
    paymentChargeId: z.string().describe("Telegram payment charge ID"),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    eggsAdded: z.number().optional(),
  }),
  
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("💳 [processPaymentTool] Processing payment:", context);
    
    if (context.starsAmount % 10 !== 0) {
      logger?.warn("⚠️ [processPaymentTool] Invalid stars amount (not divisible by 10)");
      return {
        success: false,
        message: "Ошибка: неверная сумма оплаты.",
        eggsAdded: 0,
      };
    }
    
    const existingPayment = await pool.query(
      `SELECT * FROM kinder_payments WHERE telegram_payment_charge_id = $1`,
      [context.paymentChargeId]
    );
    
    if (existingPayment.rows.length > 0) {
      logger?.warn("⚠️ [processPaymentTool] Duplicate payment detected");
      return {
        success: false,
        message: "Этот платёж уже был обработан.",
        eggsAdded: 0,
      };
    }
    
    const eggsToAdd = Math.floor(context.starsAmount / 10);
    
    await pool.query(
      `INSERT INTO kinder_payments (telegram_payment_charge_id, telegram_id, stars_amount, eggs_purchased) VALUES ($1, $2, $3, $4)`,
      [context.paymentChargeId, context.telegramId, context.starsAmount, eggsToAdd]
    );
    
    await getOrCreateUser(context.telegramId, context.userName);
    
    await pool.query(
      `UPDATE kinder_users SET paid_eggs_balance = paid_eggs_balance + $1, updated_at = NOW() WHERE telegram_id = $2`,
      [eggsToAdd, context.telegramId]
    );
    
    const user = await getOrCreateUser(context.telegramId, context.userName);
    
    logger?.info("✅ [processPaymentTool] Payment processed, eggs added:", eggsToAdd);
    
    return {
      success: true,
      message: `✅ Оплата прошла успешно!\n\n🥚 Добавлено яиц: ${eggsToAdd}\n📊 Всего яиц: ${user.free_eggs_remaining + user.paid_eggs_balance}\n\nНапиши "открыть" чтобы открыть яйцо!`,
      eggsAdded: eggsToAdd,
    };
  },
});
