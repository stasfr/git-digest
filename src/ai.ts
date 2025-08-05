import OpenAI from 'openai';

import { StatisticsCollector } from './statistics.js';

const privateConstructorKey = Symbol('AiWorker.private');

interface AiWorkerProps {
  apiKey: string;
  modelName: string;
  statisticsCollector: StatisticsCollector;
}

export class AiWorker {
  #modelName: string;

  #client: OpenAI;

  #statisticsCollector: StatisticsCollector;

  private constructor(props: AiWorkerProps, key: symbol) {
    if (key !== privateConstructorKey) {
      throw new Error('Private constructor access error');
    }

    this.#client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: props.apiKey,
    });
    this.#modelName = props.modelName;
    this.#statisticsCollector = props.statisticsCollector;
  }

  static create(props: AiWorkerProps): AiWorker {
    return new AiWorker(props, privateConstructorKey);
  }

  private generateSystemPrompt(): string {
    return `
      # Роль:
      Ты — AI-ассистент тимлида, специализирующийся на анализе логов git и составлении отчетов о проделанной работе. Ты преобразуешь технические списки коммитов в понятные для менеджмента отчеты.

      # Задача:
      Твоя главная цель — группировать связанные коммиты в единые, содержательные пункты. Каждый пункт должен описывать реализованную функциональность, улучшение или исправление с точки зрения ценности для продукта или кодовой базы.

      # Правила и ограничения:
      1.  **Формат пункта:** Каждый пункт должен начинаться со строчной (маленькой) буквы и обязательно заканчиваться точкой с запятой (;).
      2.  **Стиль:** Используй глаголы совершенного вида в прошедшем времени (например: реализован, добавлен, исправлена, оптимизирована, проведен рефакторинг).
      3.  **Фильтрация:** Игнорируй неинформативные коммиты, такие как слияние веток (merge), исправление опечаток (typo), обновление зависимостей (chore, deps), если они не несут значимой информации о задаче.
      4.  **Точность:** Основывай отчет ИСКЛЮЧИТЕЛЬНО на информации из предоставленных коммитов. Не додумывай и не добавляй ничего от себя.
      5.  **Вывод:** Результат должен быть только списком пунктов. Без заголовков, вступлений или заключений.

      # Пример идеального результата:
      реализован новый виджет "Задачи" с интерфейсом на вкладках для объединения и мониторинга задач из различных систем;
      реализована возможность прикрепления файлов в диалогах сервисных заявок путем вставки из буфера обмена (Ctrl+V);
      добавлены анимации наведения для кнопок для улучшения визуального отклика и пользовательского опыта;
      проведен рефакторинг системы управления правами доступа для повышения ее надежности и упрощения дальнейшей поддержки;
    `;
  }

  private generateUserPrompt(commits: string): string {
    return `
      Проанализируй следующие коммиты и сгенерируй отчет, строго следуя правилам и формату, заданным в твоих инструкциях.

      Коммиты для анализа:
      ${commits}
    `;
  }

  public async generateReport(commits: string): Promise<string | null> {
    const systemPrompt = this.generateSystemPrompt();
    const userPrompt = this.generateUserPrompt(commits);

    const completion = await this.#client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: this.#modelName,
    });

    this.#statisticsCollector.incrementPromptTokens(completion.usage?.prompt_tokens ?? 0);
    this.#statisticsCollector.incrementCompletionTokens(completion.usage?.completion_tokens ?? 0);

    return completion.choices[0].message.content;
  }
}
