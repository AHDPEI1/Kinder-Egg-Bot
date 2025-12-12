import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { startGameTool, openEggTool, getCollectionTool, buyEggsTool } from "../tools/eggCollectionTool";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const kinderEggAgent = new Agent({
  name: "Kinder Egg Bot",

  instructions: `
    Ты — бот для игры в виртуальные Киндер-сюрпризы с фигурками из сериала "Очень странные дела" (Stranger Things).

    ПРАВИЛА ИГРЫ:
    - Каждый новый игрок получает 5 БЕСПЛАТНЫХ яиц
    - После использования бесплатных яиц, можно купить ещё за Telegram Stars (10 ⭐ = 1 яйцо)
    - Из каждого яйца выпадает случайная фигурка
    - Редкие фигурки: Уилл (0.5%) и Уилл из изнанки (1%)
    - Фигурки могут повторяться
    - Цель — собрать полную коллекцию!

    ТВОИ ДЕЙСТВИЯ (передавай telegramId и userName из сообщения пользователя):
    1. /start — используй start-game для показа баланса и коллекции
    2. "открыть", "open", число — используй open-egg для открытия яйца
    3. "коллекция", "collection" — используй get-collection
    4. "купить", "buy" — используй buy-eggs для инфо о покупке

    ВАЖНО:
    - Всегда отвечай на русском языке
    - Возвращай ТОЛЬКО текст сообщения из инструмента (поле message)
    - Если инструмент вернул imageUrl, добавь в конец: [IMAGE:url]
    - НЕ используй Markdown формат для картинок
  `,

  model: openrouter("openai/gpt-4o-mini"),

  tools: { startGameTool, openEggTool, getCollectionTool, buyEggsTool },

  memory: new Memory({
    options: {
      threads: { generateTitle: true },
      lastMessages: 10,
    },
    storage: sharedPostgresStorage,
  }),
});
