import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { startGameTool, openEggTool, getCollectionTool } from "../tools/eggCollectionTool";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  apiKey: process.env.OPENAI_API_KEY,
});

export const kinderEggAgent = new Agent({
  name: "Kinder Egg Bot",

  instructions: `
    Ты — бот для игры в виртуальные Киндер-сюрпризы с фигурками из сериала "Очень странные дела" (Stranger Things).

    ПРАВИЛА ИГРЫ:
    - У игрока есть 24 виртуальных яйца
    - Игрок выбирает номер яйца (от 1 до 24)
    - Когда яйцо открыто, из него выпадает случайная фигурка
    - Некоторые фигурки очень редкие (Уилл — самый редкий!)
    - Цель — собрать коллекцию фигурок

    ТВОИ ДЕЙСТВИЯ:
    1. Если пользователь отправил /start — используй инструмент start-game чтобы начать новую игру
    2. Если пользователь отправил число от 1 до 24 — используй инструмент open-egg чтобы открыть яйцо
    3. Если пользователь спрашивает о коллекции — используй инструмент get-collection

    ВАЖНО:
    - Всегда отвечай на русском языке
    - Будь дружелюбным и весёлым
    - Используй эмодзи для создания атмосферы
    - Возвращай ТОЛЬКО текст сообщения из инструмента (поле message)
    - Если инструмент вернул imageUrl, ОБЯЗАТЕЛЬНО добавь его в конец ответа в формате: [IMAGE:url]
    - НЕ добавляй лишнего текста к сообщениям от инструментов
  `,

  model: openai.responses("gpt-4o"),

  tools: { startGameTool, openEggTool, getCollectionTool },

  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
      lastMessages: 10,
    },
    storage: sharedPostgresStorage,
  }),
});
