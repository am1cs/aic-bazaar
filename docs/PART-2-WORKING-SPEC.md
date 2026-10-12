# AIC Bazaar — рабочее ТЗ части 2

Версия: 1.1. Дата подготовки и обновления: 13 октября 2026 года.

**Статус: frontend реализован; локальные проверки и визуальная проверка прошли. Пользователь выбрал локальный запуск. Подписание через Phantom, два UX-прогона и запись видео ещё не выполнены.**

Владелец части 2: @destinesia7187. Исполнитель: Codex совместно с владельцем.
Рабочая ветка: `codex/part-2-web`.
Канонический файл в репозитории: `docs/PART-2-WORKING-SPEC.md`.

Документ задаёт проверяемые требования. Отсутствие ошибок нельзя гарантировать заранее: готовность подтверждается проверками, реальными результатами и зафиксированными ограничениями. Пустой чекбокс означает «не проверено», а не «работает».

## 1. Основания и порядок применения

Перед реализацией прочитать этот файл, `AGENTS.md`, `docs/PART-2.md`, `docs/INTEGRATION.md`, `shared/api.ts`, оба status-файла и актуальный SDK handoff.

Источники:

- [Репозиторий](https://github.com/am1cs/aic-bazaar).
- [Задание части 2](https://github.com/am1cs/aic-bazaar/blob/main/docs/PART-2.md).
- [Общие правила](https://github.com/am1cs/aic-bazaar/blob/main/docs/INTEGRATION.md).
- [Типы API](https://github.com/am1cs/aic-bazaar/blob/main/shared/api.ts).

Изученные снимки: основная и frontend-ветка — `d9e22e831742f2856bd2a3ef0acb5d9558266b73`; ветка контракта/SDK — `845312c3f1ce56b4867d6176b4733cdea2f8372f`.
В этих снимках frontend не реализован; в ветке части 1 уже есть исходники контракта, SDK, IDL и тесты. Deployment manifest содержит `not_deployed`. Это сведения о снимке, а не утверждение о текущем процессе сборки или состоянии сети.

При начале работы сверить актуальные версии и изменения друга. Новые сообщения человека определяют текущую задачу. Старое расписание хакатона не использовать как действующий таймер. Если API или финансовые условия изменились, сначала установить согласованную версию интерфейса; несовпадение не исправлять незаметным изменением SDK или контракта.

Создание этого ТЗ не запускает реализацию. Начать приложение после команды владельца. Документ можно уточнять по его указаниям, сохраняя согласованность общих интерфейсов.

## 2. Цель и объём MVP

Создать веб-приложение, которое проводит сделку между бизнесом-заказчиком и человеком, создающим AI-контент:

1. Заказчик фиксирует условия и резервирует весь бюджет.
2. Выбранный креатор принимает условия и вносит залог.
3. Креатор сдаёт материал текущего этапа.
4. Заказчик принимает материал и оплачивает этап.
5. При разногласии сторона открывает спор; назначенный человек-арбитр принимает решение.
6. Интерфейс показывает подтверждённые выплаты, возвраты и материалы оплаченных этапов.

Первый шаблон — 15-секундное вертикальное рекламное AI-видео. Участники уже нашли друг друга и обмениваются ссылкой на сделку. Сеть — Solana Devnet; актив — тестовый SOL. Интерфейс, описание демо и материалы продукта — на английском.

В объём не входят: поиск креаторов, каталог, конкурсы, AI-агенты, генерация контента, чат, рейтинги, USDC, карты, Dodo Payments, встроенные кошельки, серверные загрузки материалов, автоматическая оценка качества, автоматический штраф/выплата по таймеру, юридическая передача авторских прав, mainnet.

## 3. Владение файлами и Git

Часть 2 создаёт/изменяет `web/`, `docs/PART-2.md`, этот рабочий документ, `docs/status/part-2.md`, `docs/demo.md`, `docs/usability.md`.
`contracts/`, `sdk/`, `deployment/` и документы части 1 принадлежат другу. `shared/`, `README.md`, `AGENTS.md`, `.github/`, `.gitignore`, `docs/INTEGRATION.md` — общие области.

- У каждого участника свой локальный клон.
- Перед реализацией проверить состояние Git и существующие изменения; обновление remote выполнить в рамках начатой работы. Ничего не сбрасывать и не перезаписывать.
- Работать в существующей `codex/part-2-web`; не создавать замену ветки без необходимости.
- Не использовать force push, reset --hard или git clean.
- SDK подключать после согласованной передачи/PR части 1. Не копировать самостоятельный форк SDK внутрь `web/`.
- Общие типы и финансовые правила меняются через согласованный PR с review другого участника.
- Завершённые этапы передавать небольшими PR; обновлять только свой status-файл фактическими результатами.
- Не добавлять корневой npm workspace или общий lockfile. Root configuration changes оформлять отдельным reviewed PR при необходимости.
- ТЗ не считается опубликованным в GitHub только потому, что сохранено локально. Commit/push и отправка сообщения другу — отдельные действия.

## 4. Архитектура и обязательная граница SDK

Стек: React + TypeScript + Vite + Tailwind; Solana Wallet Adapter и Phantom.
Пакет интерфейса и lockfile находятся в `web/`.

Операции со сделками выполняются только через `BazaarClient`:

| Задача | Метод |
| --- | --- |
| Чтение | `getDeal(address)` |
| Создание и бюджет | `createDeal(input)` |
| Принятие и залог | `acceptDeal(address)` |
| Сдача/замена материала | `submitMilestone(input)` |
| Приёмка и выплата | `approveMilestone(input)` |
| Открытие спора | `openDispute(address, reason)` |
| Решение арбитра | `resolveDispute(address, outcome, reason)` |
| Отмена до принятия | `cancelUnaccepted(address)` |

Подключение: `@aic-bazaar/sdk` через `file:../sdk`.
Фабрика: `createBazaarClient({ connection, wallet, programId })`.
Для чтения — `wallet: null`; для действий — актуальный `useAnchorWallet() ?? null`.
Изученный SDK закрепляет web3.js `1.98.4` и Anchor `0.32.1`. Совместимые версии зависимостей фиксируются в lockfile после проверки. Не смешивать web3.js v1 и v2.

UI не импортирует IDL и не разбирает Anchor account layout. SDK экспортирует нормализованные типы и `calculateAmounts()` для точных расчётов. Generic RPC чтение статуса подписи допустимо для выяснения результата транзакции; оно не заменяет методы сделок.

Vite/TypeScript должны разрешать исходники соседних `sdk/` и `shared/`. SDK экспортирует TypeScript source, а не готовый standalone bundle. После установки убедиться, что зависимости SDK и browser polyfills корректно попали в production-сборку.

Предлагаемое разделение внутри `web/src/`: страницы, компоненты, providers, SDK integration, transaction controller, validation/money/file helpers. Конкретные имена файлов можно выбрать при реализации; внешняя граница остаётся неизменной.

## 5. Deployment и конфигурация

Публичные параметры получаем из согласованных deployment-данных части 1: cluster/RPC, programId, arbiterAddress, demoDeals. Проверка конфигурации выполняется до доступности финансовых действий.

- Только Devnet. Hosted app не включает `allowLocalValidator`.
- Не подставлять System Program, произвольный programId или фиктивного арбитра при отсутствующей конфигурации.
- Зарезервированный programId и статус-файл не доказывают deployment.
- SDK проверяет Devnet genesis, совпадение IDL address и наличие executable program account. Не обходить эти проверки.
- При `not_deployed` показать понятный статус недоступности реальных операций; приложение не должно падать целиком.
- При сетевой ошибке показать сетевую ошибку, а не утверждать отсутствие deployment.
- Demo links появляются только для реальных адресов из подтверждённой передачи.
- Любая `VITE_*` конфигурация публична. Приватные ключи и секретные RPC токены в неё не помещать.

Допустим отдельный developer-only UI preview с явной надписью `UI preview — no blockchain transactions`. Fixtures исключены из production transaction path. Production без deployment показывает недоступность, а не незаметно переключается на mocks.

## 6. Экраны, маршруты и общий интерфейс

| Экран | Маршрут | Назначение |
| --- | --- | --- |
| Главная | `/` | Объяснение, создание и открытие сделки |
| Создание | `/create` | Условия и резервирование бюджета |
| Сделка | `/deal/:address` | Этапы, материалы, деньги и действия |
| Спор | `/deal/:address/dispute` | Причина, evidence и арбитраж |

На всех экранах: AIC Bazaar, `Devnet · Test SOL`, состояние кошелька, понятная навигация. Английский UI. Общий layout доступен даже без deployment или кошелька.

Главная содержит краткое объяснение, `Create deal`, поле адреса с `Open deal`, пояснение бюджета/залога/этапов/арбитра и реальное демо, когда оно доступно. API не содержит `listDeals`: не добавлять обещание полного списка сделок или каталога.

Для страниц чтения предусмотреть loading, loaded, invalid address, not found, RPC error, not deployed, refreshing/stale data. Не показывать отсутствующую сделку как нулевой escrow. Кнопка `Refresh` читает данные из сети.

Для mobile от 360 px и desktop: без горизонтального переполнения, читаемые деньги и даты, адаптивные карточки. Статусы имеют текст; цвет не является единственным сигналом. У полей есть labels, ошибок — связь с полем, у async updates — доступное уведомление. Keyboard navigation и видимый focus обязательны.

## 7. Phantom и полномочия

- Просмотр не требует установки Phantom, входа или подписи.
- Если Phantom не обнаружен, показать понятную установку/подключение; автоматически не открывать popup.
- Состояния: disconnected, connecting, connected, unsupported signing wallet, disconnected during operation.
- Роль определяется сравнением адреса с `deal.client`, `deal.creator`, `deal.arbiter`. Посторонний кошелёк — viewer.
- Production role switch отсутствует. UI-ограничения дополняют enforcement SDK/контракта.
- При смене wallet немедленно пересчитать полномочия и пересоздать клиент. Не допускать действий со старым клиентом.
- Если операция уже запущена, связать её с исходным кошельком и адресом сделки. Смена аккаунта не отменяет автоматически уже подписанную транзакцию и не переносит receipt на новый аккаунт.
- Открывать wallet request только вследствие явного действия пользователя.

| Deal status | Заказчик | Креатор | Арбитр/Viewer |
| --- | --- | --- | --- |
| `awaiting_creator` | Cancel & refund | Accept & deposit | Read only |
| `active` | Approve submitted current milestone; Open dispute | Submit/one replacement current milestone; Open dispute | Read only |
| `disputed` | Read only | Read only | Только указанный arbiter: resolve |
| `completed`, `resolved`, `cancelled` | Read only | Read only | Read only |

В terminal states `currentMilestone` может быть null. Не индексировать массив этапов без проверки. Wrong wallet получает объяснение роли, а не кнопку, которая выглядит доступной.

## 8. Форма создания

| Поле | Обязательность и правила |
| --- | --- |
| Title | Непустой, до 64 UTF-8 bytes |
| Brief | Непустой, до 200 UTF-8 bytes |
| Creator wallet | Валидный signing wallet address |
| Arbiter | Согласованный адрес из конфигурации; виден полностью до подписи |
| Budget SOL | Строка, 0.001–1 SOL включительно; максимум 9 знаков после точки |
| Concept/Draft/Final deadlines | Три будущих integer Unix seconds, строго возрастают |
| References URL | Пустая строка или валидный HTTPS URL до 200 UTF-8 bytes |

Client — подключённый кошелёк. Client/creator/arbiter различаются и не равны default/System Program. Участники должны быть on-curve signing wallet addresses, как требует текущий SDK. Если arbiter отсутствует или совпадает с участником, создание недоступно.

Ввод денег: trim внешних пробелов; десятичная точка; scientific notation, отрицательные числа, NaN/Infinity, разделители тысяч и неоднозначная запятая отклоняются с подсказкой. Парсинг строковый через BigInt; значение преобразуется в каноническую unsigned base-10 lamport string без ведущих нулей. Не использовать Number/parseFloat для денег. Пустой или частично набранный ввод не считать нулевым бюджетом.

Даты вводятся в явно указанном часовом поясе и переводятся в Unix seconds. Invalid date, небезопасное целое, порядок и прошлые даты проверяются перед вызовом SDK. Если во время заполнения срок стал прошлым, повторная валидация блокирует создание.

До подписи показать участников, бюджет, три выплаты, залог, критерии, сроки и полномочия арбитра. Отдельно объяснить rent и transaction fee; не выдавать выдуманные фиксированные суммы за оценку сети. Создание дебетует бюджет + rent + fee. Креатор затем отдельно оплачивает залог + fee.

`Create & fund deal` вызывает `createDeal()` после финальной валидации. После MutationResult показать signature, dealAddress, Explorer и share link; перейти на сделку либо показать confirmed receipt с Refresh при ошибке чтения. Ошибки сохраняют draft полей. В localStorage допустим только черновик формы; не хранить ключи, файлы или authoritative financial state.

## 9. Точные деньги и инварианты

API принимает unsigned decimal integer strings в lamports. Budget: 1,000,000–1,000,000,000. Расчёт через BigInt/SDK `calculateAmounts()`:

- concept = floor(budget * 20 / 100);
- draft = floor(budget * 30 / 100);
- final = budget - concept - draft;
- bond = floor(budget / 10);
- fee платформы = 0.

Ввод/вывод SOL сохраняет точность до lamport. Display может убирать незначащие нули, но не округлять сумму выплаты без доступа к точному значению.

| Пример | Lamports | SOL |
| --- | ---: | ---: |
| Budget | 300000000 | 0.30 |
| Concept | 60000000 | 0.06 |
| Draft | 90000000 | 0.09 |
| Final | 150000000 | 0.15 |
| Bond | 30000000 | 0.03 |

Источник финансов — поля `Deal`, а не баланс кошелька, localStorage или локальная арифметика после клика. Отображать исходный бюджет, оставшийся бюджет, исходный и locked bond, paid stages, rent отдельно. Не включать rent/unsolicited transfers в бюджет. После reload значения заново читаются через SDK.

Контроль расторжения после Concept при refund: клиенту 0.24 SOL, креатору залог 0.03 SOL; ранее полученные 0.06 SOL остаются креатору. В расчёте не смешивать сетевые комиссии с escrow payouts.

## 10. Страница сделки и материалы

Показать title/brief/references, address, участников, status, финансовую сводку, templateVersion, три milestone cards, due dates, current milestone, submission URL/hash/revision/submittedAt, paidAt, dispute и resolution.

| Этап | Критерий template v1 | Сумма |
| --- | --- | --- |
| Concept | Collage of three key frames with scene order | 20% |
| Draft | 15-second 9:16 rough cut following approved concept | 30% |
| Final | 1080x1920 MP4, agreed CTA, no watermark | Остаток |

Дать Copy для адреса сделки, адресов сторон, share link и hash; ошибки clipboard показывать без ложного Copy success. Ссылки на Explorer явно указывают Devnet. Полные адреса доступны при сокращённом display.

После оплаты материал этапа остаётся виден и недоступен для замены. API хранит актуальную submission каждого этапа; не обещать архив первой неоплаченной версии после replacement. Произвольные внешние preview/iframes не обязательны: достаточно безопасной ссылки. Доступность внешнего файла не гарантируется блокчейном и не объявляется доказанной.

## 11. Сдача и локальное хэширование

Креатор текущего active milestone вводит HTTPS URL, выбирает локальный файл, вычисляет SHA-256 и подтверждает Submit. Файл не отправляется на сервер.

- Hash — 64 lowercase hex, полученный из выбранных bytes.
- До расчёта отправка заблокирована; показать состояние/ошибку hashing.
- При смене файла очистить старый hash. Request token исключает гонку: поздний hash файла A не заменяет уже выбранный B.
- При unmount/смене сделки результат старого расчёта игнорируется.
- Защитить память: выбрать и документировать проверенный лимит размера файла; не обещать произвольный размер при Web Crypto digest с полным буфером. Ошибка чтения/памяти не превращается в успешную сдачу.
- Первый submit: `expectedRevision: 0`. Единственный replacement: `expectedRevision: 1`. Hash/URL/revision относятся к одному выбранному набору.
- Если текущая revision уже 2, replacement недоступен. Paid/disputed/terminal stages не допускают submit.
- Объяснить, что hash не доказывает качество, авторство и совпадение файла с содержимым URL.
- Обсуждение правок происходит вне приложения; отдельного on-chain Request changes API нет.

## 12. Приёмка, сроки и отмена

Заказчик читает submission и подтверждает `Approve & pay`. Confirmation view содержит stage, точную сумму, URL, revision и hash. Для Final отдельно показать возврат всего locked bond.

Approval отправляет просмотренные index/revision/hash. Нельзя незаметно подставлять обновлённые значения. При `stale_submission` обновить сделку, сбросить старое подтверждение и потребовать повторного просмотра пользователем; не retry автоматически.

Сроки и 24h review period информационные. Review отсчитывается от последней submission, включая replacement. Просрочка не создаёт выплату, штраф или автоматический запрет submit. Правила и даты не редактируются после создания.

До accept заказчик может вызвать Cancel & refund. После accept кнопка отмены отсутствует: завершение разногласия проводится через dispute/arbiter. Не добавлять новый финансовый сценарий взаимной отмены поверх имеющегося API.

## 13. Споры

Client или creator может открыть dispute при active, включая момент до submission. Reason непустой, до 200 UTF-8 bytes. После подтверждения показывается frozen state: submit/replacement/обычный approval недоступны.

Спор показывает инициатора, openedAt, reason, условия, текущий материал, ранее оплаченные материалы, remaining budget, locked bond и указанного arbiter.

| Outcome | Клиент получает | Креатор получает | Условие |
| --- | --- | --- | --- |
| `pay_current` | Remaining budget минус current amount | Current amount + locked bond | Current submission существует |
| `refund` | Remaining budget | Locked bond | Disputed |
| `creator_breach` | Remaining budget + locked bond | 0 новых выплат | Disputed |

Все outcomes закрывают сделку. Предыдущие выплаты не отменяются; произвольного получателя и partial award нет. Arbiter обязан выбрать outcome и непустое обоснование до 200 UTF-8 bytes. Перед подписью показывается точный расчёт и предупреждение о завершении сделки. `pay_current` без submission недоступен.

Креатор и клиент читают итог; самостоятельно присваивать залог клиент не может. UI раскрывает доверенную роль указанного человеческого арбитра и не обещает автоматическую юридическую передачу прав. Upgrade authority отражается по проверенным данным handoff; отсутствие сведений обозначается явно.

## 14. Контроллер операций и асинхронность

Одна финансовая операция на deal одновременно. Lock ставится синхронно до первого await; одного React setState для защиты от двойного клика недостаточно. На создание — отдельный single-flight lock. Во время выполнения связанные mutation buttons disabled.

Операция получает неизменяемый контекст: operation/attempt ID, action, исходный wallet, dealAddress при наличии, просмотренный stage/revision/hash. Переключение route или wallet не должно приписывать её результат другому экрану.

Чтение использует request ID либо эквивалентную защиту stale responses. Если route A сменился на B, поздний ответ A не перезаписывает B. Ошибки/формы старой сделки сбрасываются. После изменения сначала получить актуальный Deal, затем включить действия.

Текущий BazaarClient не предоставляет lifecycle callbacks. Реализовать честное общее pending-состояние, подсказку следовать запросу кошелька и итог. Не показывать «уже отправлено» или signature до фактического получения соответствующих данных. Детальные callbacks требуют согласованного SDK изменения.

## 15. Receipt, неизвестный результат и восстановление

| Результат | Обязательное поведение |
| --- | --- |
| MutationResult с Deal | Confirmed receipt, signature, Explorer, новое состояние |
| MutationResult с `deal: null`/refreshError | Confirmed receipt; Refresh через getDeal; не повторять платеж |
| BazaarError с `outcomeUnknown === true` | Показать signature при наличии; Check status; не показывать failure или success без проверки |
| user_rejected до отправки | Понятная отмена; сохранить форму; новое действие только по явному клику |
| Доказанная on-chain failure | Показать failure; обновить state; повторное действие только по явному клику |

Для Check status использовать `getSignatureStatuses` с `searchTransactionHistory: true`. Confirmed/finalized и отсутствие err подтверждают операцию; processed остаётся ожиданием; err означает неуспех; null/timeout/RPC error остаются неизвестным результатом. Отсутствие записи не является разрешением повторно оплатить. Не включать automatic mutation retry; разрешены ограниченные повторные read requests с backoff.

Наличие signature само по себе не означает outcomeUnknown: подпись бывает и у доказанной `transaction_failed`. Классифицировать результат по outcomeUnknown, error code и фактическому RPC status. При unknown без доступной signature показать необходимость ручной проверки; не выдумывать подпись и не разрешать повтор по timeout.

До ухода/reload при pending предупредить о незавершённой операции. Для восстановления в той же вкладке допустим минимальный sessionStorage-журнал несекретных attempt metadata: action, исходный wallet, dealAddress при наличии, signature после её получения, startedAt и unresolved flag. Это не источник balances/status; всё финансовое состояние читается из сети. Не записывать keypairs, файлы, секреты или signed raw transactions. LocalStorage остаётся только для draft формы.

Интеграционные пределы текущего SDK:

1. При uncertain createDeal ошибка не содержит dealAddress; SDK генерирует ID внутри. После подтверждения signature показать receipt и Explorer. Автоматическое восстановление адреса требует согласованного SDK handoff; до него можно открыть найденный через Explorer адрес вручную.
2. Если reload произошёл до возврата signature из SDK, полная recovery не гарантируется. Сохранённый unresolved attempt не трактовать как failure; показывать необходимость проверки до нового действия, особенно Create.
3. SessionStorage не обеспечивает cross-device/cross-tab exactly-once. Для существующей сделки от повторных выплат защищают state/revision checks программы; Create не является идемпотентным методом по текущему API.

Эти пределы зафиксировать в status/handoff и проверить до real-demo. Не добавлять самовольный Anchor parsing или изменённый shared error schema. Улучшение recovery согласовывается с частью 1; интерфейс можно делать независимо.

## 16. Валидация, ошибки и безопасный вывод

Байт-счётчик — TextEncoder. Title 64, brief/references/submission/dispute reason/resolution reason 200 UTF-8 bytes. Проверять ровно лимит и превышение, кириллицу и emoji; счётчик символов не заменяет байт-счётчик. Непустые поля не принимают whitespace-only.

URL: literal lowercase `https://`, валидный hostname; без spaces, control chars, backslashes, credentials. References допускает действительно пустую строку. Все значения повторно валидируются перед действием. UI safely renders text; не использовать dangerouslySetInnerHTML. Внешние ссылки — target blank с rel noopener noreferrer. Не fetch произвольные URL с сервера.

| Code | UX |
| --- | --- |
| wallet_required | Connect signing wallet |
| wrong_role | Explain required participant wallet |
| invalid_input | Field-level actionable validation |
| invalid_state | Refresh deal and recompute actions |
| stale_submission | Refresh and re-review; no automatic approval |
| revision_limit | One replacement already used |
| insufficient_funds | Need test SOL for debit/rent/fee |
| user_rejected | Request cancelled, not payment success |
| rpc_error | Retry reading/check signature; unknown handling when applicable |
| transaction_failed | Transaction failed; show known signature if present |
| not_found | No valid deal at this address |
| not_deployed | Real contract operations unavailable |

Не выводить секреты/полные внутренние logs в UI и screenshots. Не терять actionable signature. Неизвестную ошибку показать понятным общим сообщением без выдуманного code. После read failure last-known data маркируются stale; mutation actions остаются заблокированными до refresh.

## 17. Vercel и воспроизводимая сборка

Уточнение пользователя от 13 октября: **пока оставить приложение локально**. Vercel publication сейчас не выполнять; конфигурацию сборки сохранить для будущей публикации. Проверка локального production build не означает проверку хостинга Vercel.

Публикуется статический frontend. GitHub checkout должен содержать `web/`, `sdk/`, `shared/` и нужную публичную конфигурацию. Root Directory Vercel — web; подтвердить настройку включения исходников вне Root Directory и разрешение file dependency.

- Dependency install/build команды выбрать и записать после реальной проверки полного layout; не считать обычный npm ci в web достаточным, пока зависимости sibling SDK не подтверждены.
- При Root Directory = `web` настройка Vercel Output Directory = `dist`. Путь артефакта относительно корня репозитория — `web/dist`.
- Production build из clean checkout обязателен; dev server не является доказательством build.
- Нужен SPA fallback для client routes с нормальной выдачей существующих assets.
- Проверить прямое открытие и reload обоих deal routes, invalid address и 404 UI.
- Просмотр публичен, без обязательного подключения кошелька.
- SDK/IDL/config bundle не содержат секретов и developer fixture transaction path.

В web/package.json предусмотреть воспроизводимые команды dev, build, typecheck, test и используемую browser verification. Не добавлять lint-only работу, которая не нужна требованиям. Записать точные реально прошедшие команды и URL deployment в status.

## 18. План реализации и контрольные точки

| ID | Работа | Проверяемый выход |
| --- | --- | --- |
| UI-01 | Сверить repo/API/handoff, подготовить web package | Зафиксированные зависимости, сборка каркаса |
| UI-02 | Layout, четыре routes, формы и validation | Рабочие экраны, доступность, labeled dev preview |
| UI-03 | Read-only client, Phantom, роли, deployment gating | Просмотр без wallet, корректный wallet switch |
| UI-04 | Create/accept/cancel, single-flight, receipts | Реальные подтверждённые операции при готовом deployment |
| UI-05 | File hash, submit/replacement/approve | Реальные stages и stale protection |
| UI-06 | Dispute/три outcomes | Верные расчёты и terminal UI |
| UI-07 | Error/recovery, async race hardening | Нет ложного успеха или автоматической повторной оплаты |
| UI-08 | Responsive/build/Vercel direct routes | Публичный production build и reload |
| UI-09 | Devnet matrix и два UX-прогона | Evidence, исправления, честные ограничения |
| UI-10 | Demo assets/script/recording handoff | Product demo до 3 минут и доступные доказательства |

Не переключаться на украшения при нерешённых денежных P0/P1. При нехватке времени сокращать animation, optional previews и необязательный polish. Escrow, последовательность этапов, права, disputes, возвраты и truthful transaction state сохраняются. Если deployment не готов, отдельно сдавать UI progress и отмечать real checks blocked.

## 19. Матрица проверки

До завершения запускать typecheck, unit/component tests по существенным рискам, production build и browser checks. Все новые inputs после изменения вновь проверять соответствующими тестами. Рутинно повторять уже прошедшие неизменённые проверки без причины не требуется.

| ID | Проверка | Ожидаемый результат | Доказательство |
| --- | --- | --- | --- |
| Q-01 | 0.001/1 SOL и значения вне диапазона | Границы приняты, вне диапазона отклонено | Automated validation |
| Q-02 | 1 lamport точности, budget 1000001 | Exact split; сумма stages равна budget | Automated money test |
| Q-03 | NaN/negative/exponent/10 decimals | Нет неявной конвертации | Automated validation |
| Q-04 | UTF-8 limit/over-limit/emoji/blank | Корректная byte validation | Automated validation |
| Q-05 | Bad URLs/credentials/control chars | Поля отклонены до wallet popup | Automated validation |
| Q-06 | Invalid/default/off-curve/duplicate wallets | Создание недоступно | Automated validation |
| Q-07 | Future/increasing dates; дата устарела в форме | Корректная повторная проверка | Automated validation |
| Q-08 | View без wallet, wrong wallet, account switch | Read-only и правильные роли | Browser + Devnet |
| Q-09 | Route A→B с поздним ответом A | Экран B не перезаписан | Async component test |
| Q-10 | File A→B, ошибка hashing, size bound | Hash относится к текущему файлу | Automated/browser |
| Q-11 | Double click и overlapping mutations | Один вызов SDK на attempt/deal | Component test |
| Q-12 | Create→accept→три approve | Completed, remaining budget/bond ноль | Real Devnet signatures |
| Q-13 | Cancel до accept | Budget returned; terminal read-only | Real Devnet signature |
| Q-14 | One replacement, третья submission | Revision 2; третья недоступна | Real Devnet + UI |
| Q-15 | Старые index/revision/hash | Stale approval отклонён; re-review | Real Devnet/SDK evidence |
| Q-16 | Спор до submission | Спор доступен; pay_current недоступен | Real Devnet + UI |
| Q-17 | Спор после Concept: pay_current/refund/breach | Три точных расчёта на отдельных deals | Real Devnet signatures |
| Q-18 | Final approval | Final payout + весь bond | Real Devnet signature |
| Q-19 | Disputed/terminal/wrong signer | Недоступные действия не исполняются | UI + part1 enforcement evidence |
| Q-20 | user_rejected/insufficient funds/RPC error | Нет ложного success, draft сохранён | Controlled SDK tests/browser |
| Q-21 | Confirmed result, deal null | Receipt + refresh, no repeat payment | Component test |
| Q-22 | outcomeUnknown; null/processed/err/confirmed | Только подтверждённые выводы | Controlled RPC tests |
| Q-23 | Reload mid-operation/uncertain create | Неизвестность сохранена и раскрыта | Browser + SDK handoff |
| Q-24 | Reload/другое устройство/direct deal URL | State из сети, view без wallet | Published site check |
| Q-25 | Нет deployment/wrong network | Понятная недоступность, no mocks | SDK + hosted UI |
| Q-26 | Vercel clean build с sibling SDK/shared | Рабочий bundle и routes | Build logs + live URL |
| Q-27 | Mobile/keyboard/clipboard failure | Используемый доступный интерфейс | Browser QA |
| Q-28 | Paid materials после dispute/closure | Ссылки/хэши доступны | Real deal + UI |

Каждый результат отмечать отдельно: `PASS — Devnet`, `PASS — controlled UI/fixture`, `FAIL`, `BLOCKED`, `NOT RUN`. Unit/mock test не является доказательством on-chain escrow. Реальные signatures и expected/actual outcomes записывать без секретов. Проверки enforcement программы принадлежат части 1; их handoff не заменяет наш frontend flow check.

P0: ложный платёжный успех, неправильный получатель/сумма, автоматическая повторная оплата, обход роли или mainnet path. P1: потерянный/неверно приписанный receipt, сломанный core flow, stale approval, невосстановимые без объяснения uncertain states, неработающий production route. Известные P0/P1 исключают статус «часть завершена»; отсутствие deployment отмечается blocker, а не «всё работает».

## 20. Пользовательские прогоны и demo

Два добровольца выполняют задачи без подсказок. В docs/usability.md: дата, задача, окружение без идентифицирующих данных, наблюдение, проблема, исправление и повторная проверка. Пока прогонов нет — `NOT RUN`; отзывы не выдумывать.

Подготовить собственные concept/draft/final assets с ясным обозначением demo заказа. Материалы не выдавать за реального платящего клиента. Сеть и тестовые средства видны на записи.

Две реальные сделки: completed и resolved после оплаченного Concept. Product demo ≤3 минут, ориентир 2:40:

| Время | Содержание |
| --- | --- |
| 0:00–0:20 | Проблема, заказ и условия |
| 0:20–0:55 | Бюджет и залог |
| 0:55–1:30 | Submission, approval и фактическая выплата |
| 1:30–2:10 | Спор, решение и возвраты |
| 2:10–2:40 | Оплаченные материалы и Explorer evidence |

Сценарий — docs/demo.md. Человек публикует видео в согласованном аккаунте. Pitch/technical description относятся к части 1. Проверить доступность demo URL без запроса разрешения. Сид-фразы, wallet backups и секреты не попадают в запись.

## 21. Критерии готовности и evidence handoff

- [x] UI на английском, четыре экрана и mobile layout; браузерная проверка 360/768/1440 px.
- [x] Read-only просмотр без wallet — Devnet; роли и wallet switch — controlled UI tests. Human Phantom acceptance остаётся отдельно.
- [x] Реальный SDK принят через ветку части 1; версия `a3502ca` записана.
- [x] Реальный Devnet deployment подтверждён read-only SDK checks; Program ID/IDL/config соответствуют.
- [ ] Completed и все три dispute outcomes проверены настоящими операциями.
- [x] Точные суммы, rent/fees и bond display проверены: BigInt tests + реальные read-only demo accounts.
- [x] Stale/revision/hash, double click и async races проверены controlled tests.
- [x] Cancelled/rejected/failed/unknown/confirmed-but-unreadable различаются — controlled SDK/RPC boundary tests.
- [x] Recovery ограничения раскрыты; обнаруженные frontend races и риск повторного create исправлены. Реальные wallet flows ещё не приняты.
- [x] Typecheck, 242 controlled tests, 3 Devnet read-only checks и production build прошли; исходный clean checkout `05cb977` собрался после `npm ci`.
- [ ] Vercel direct routes/reload/view без wallet проверены.
- [x] Fixtures исключены из production transaction path; в web исходниках/config только публичные данные.
- [ ] Два фактических UX-прогона записаны.
- [ ] Product demo ≤3 минут, реальный и доступный.
- [ ] PR/status/docs отражают фактическую готовность и оставшиеся blockers.

Финальная передача содержит: commit/PR, public site URL, SDK/source version, сеть/Program ID, реальные deal addresses, transaction signatures/Explorer URLs, test evidence, UX notes, demo URL и ограничения. Не объявлять заявку отправленной только по готовому сайту: отправка конкурса относится к отдельной проверке команды.

## 22. Текущий журнал подготовки

| Дата | Выполнено | Не выполнено |
| --- | --- | --- |
| 2026-10-13 | Прочитаны инструкции/API/SDK; подготовлено рабочее ТЗ | Frontend implementation, dependency install, frontend tests, hosted deployment, UX-прогоны и demo по этому ТЗ не начаты |
| 2026-10-13 | Интегрирована ветка SDK `a3502ca`; реализованы четыре экрана, Phantom adapter, денежные расчёты, формы, локальный SHA-256, роли, сделки/споры, receipt/recovery; 232 controlled tests и TypeScript прошли | Реальные frontend-операции с подписью Phantom, два человеческих UX-прогона, запись видео; Vercel отложен пользователем |
| 2026-10-13 | Пользователь передал `design/`: стиль Leonardo — чёрный фон, фиолетовая фирменная типографика, белые pill-кнопки, компактные статусы; дизайн применяется ко всем страницам | Финальная визуальная проверка после редизайна выполняется отдельно |
| 2026-10-13 | Редизайн проверен в Chrome 360/768/1440 px; production build и clean checkout `05cb977` прошли; реальные completed/refund accounts и три точных asset hashes проверены без wallet; исправлены subtitle/link inheritance и scroll при переходе из галереи | Phantom signatures через этот frontend, два человеческих UX-прогона, запись demo; Vercel по решению пользователя не публикуется |
| 2026-10-13 | По уточнению пользователя добавлена 3D типографическая сцена в духе Leonardo, закреплённое меню с рабочими dropdown/якорями, более крупный контрастный текст и движение от прокрутки; все три нижних preview фиолетовые, видео/download controls убраны. 242 tests/TypeScript/build прошли; browser QA 360/835/1440 px, Tab/Escape, focus/anchor, Motion pause и реальная scroll-transform проверены | Human Phantom acceptance, два человеческих UX-прогона, запись demo и изменение системного reduced-motion в браузере ещё не выполнены; сайт остаётся локальным |

При реализации обновлять журнал проверенными checkpoint results. Наличие этого документа не является evidence работающих транзакций.
