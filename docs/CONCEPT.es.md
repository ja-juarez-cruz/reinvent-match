# Reinvent:Match: concepto y diseño inicial

🇬🇧 [English version](CONCEPT.md)

> Un "Tinder" de **persona ↔ sesión**: no busca *la mejor sesión de re:Invent*, sino *la sesión que mejor encaja contigo*, y explica por qué.

Proyecto comunitario no oficial, sin afiliación con AWS.

---

## 1. Problema

re:Invent tiene más de 2,000 sesiones repartidas en varios venues. Quien va por primera vez:

- no sabe qué nivel (100–500) le corresponde **por tema**;
- elige por el título y termina en sesiones que explican desde cero lo que ya sabe, o en sesiones 400 de un tema que no conoce;
- no tiene en cuenta que las sesiones se enciman, ni el tiempo de traslado entre venues, ni lo que deja de ver al elegir una;
- gasta tiempo presencial en contenido que después se publica grabado.

**Pregunta que resuelve el producto:** *con lo que ya sé, lo que quiero aprender y el tiempo que tengo, ¿qué sesiones me aportan más?*

## 2. Principios

1. **Primero el perfil.** El matching parte de la persona, no del catálogo.
2. **Fit personal, no calificación absoluta.** Una misma sesión puede ser *Deep Dive* para una persona y *Skip* para otra.
3. **Toda recomendación dice por qué.** Cada resultado muestra razones a favor y posibles problemas.
4. **Dar prioridad a lo que es difícil de conseguir fuera del evento.** Workshops, chalk talks y builders' sessions valen más que un breakout que después se sube a YouTube.
5. **Reglas antes que IA.** La v1 funciona con metadatos, reglas y scoring. El LLM se usa para enriquecer datos y entender el perfil, no para decidir.

## 3. Perfil del asistente

Cada tema o servicio se asigna a uno de cuatro grupos:

| Grupo | Significado | Ejemplo |
|---|---|---|
| 🟢 **Know** | Lo uso con regularidad | Lambda, DynamoDB, API Gateway, SQS, Step Functions |
| 🟡 **Grow** | Lo quiero profundizar | Distributed systems, resiliency, multi-region, EDA |
| 🔵 **Explore** | Casi no lo conozco, pero me interesa | EKS, Bedrock, Kafka, SageMaker |
| ⚪ **Ignore** | No es relevante ahora | (lo que la persona decida) |

Además:

- **Dominio por tema** (0–3): `0` nada · `1` básico · `2` práctico · `3` avanzado.
- **Objetivos** (varios): profundizar lo que sé · aprender tecnologías nuevas · prepararme para un rol de arquitectura · hands-on · networking.
- **Preferencia de formato**: workshop, chalk talk, builders, code talk, lab, breakout.
- **Capacidad**: sesiones por día, días que asiste, bloques reservados (Expo, comida, keynotes).

```json
{
  "goals": ["architecture-role", "learn-new", "hands-on"],
  "interests": [
    { "name": "AWS Lambda", "bucket": "know", "proficiency": 3 },
    { "name": "Amazon DynamoDB", "bucket": "know", "proficiency": 3 },
    { "name": "Multi-Region", "bucket": "grow", "proficiency": 1, "keywords": ["cross-region"] },
    { "name": "EKS", "bucket": "explore" },
    { "name": "SAP", "bucket": "ignore" }
  ],
  "formatPreferences": { "chalk-talk": 1, "workshop": 0.9, "breakout": 0.4 }
}
```

Cada `name` puede ser una etiqueta del catálogo (`"AWS Lambda"`, `"Agentic AI"`) o un concepto libre (`"Multi-Region"`) que se busca en el título y el abstract. Los alias se resuelven solos: `"EKS"` encuentra `"Amazon Elastic Kubernetes Service (Amazon EKS)"`. Ejemplo completo: [`examples/profile.example.json`](../examples/profile.example.json).

## 3b. Onboarding v2: preguntas en lugar del editor de perfil (implementado)

La app tiene cinco pasos, en este orden: **hasta 8 temas para aprender o profundizar** (ocho alcanzan para una agenda completa, incluso con IA entre ellos); **tu nivel en cada tema** (New to me, Basic, Intermediate, Advanced); plataformas con las que trabajas; base de IA; formatos. Un tema marcado "new" es para aprender; cualquier otro nivel es para profundizar, y sus sesiones se juzgan contra el nivel de ese tema (Basic → 200, Intermediate → 300, Advanced → 300 y 400 es el punto ideal; un nivel más arriba es un reto). Una sesión trata del tema de su track, salvo que su título nombre una tecnología de un tema que el asistente conoce menos: "GitOps on Amazon EKS" en el track de open source se juzga por Containers. Los temas nuevos apuntan a nivel 200, o 300 si el asistente es Intermediate o Advanced en otro tema. Las respuestas guardadas con el formato anterior (known/learn/nivel global) se convierten al cargarlas. El detalle de cada respuesta:

1. **Lo que sabes:** hasta 8 **temas**. Solo los temas se pueden seleccionar; cada uno trae sus tecnologías y prácticas relacionadas, que se muestran como etiquetas de solo lectura. El límite obliga a elegir con precisión.
2. **Lo que quieres aprender:** opcional, hasta 5 temas. Sin esto, "Aprender" se infiere; la IA está en el 71% de las sesiones de re:Invent, así que nombrar un objetivo mantiene esa lista enfocada.
3. **Nivel:** básico, intermedio o alto; se aplica a lo que sabes (apunta a 200 / 300 / 400) y a temas nuevos (100–200 / 200–300 / 300).
4. **Formatos:** uno, varios o todos; es un filtro estricto.

**Plataformas con las que trabajas.** El paso pregunta con qué plataformas trabaja el asistente (o quiere aprender), no cuáles excluir: la mayoría usa ninguna o una, así que son 0–1 clics, y cada plataforma muestra su número de sesiones más un total en vivo de las que se omiten. Requiere una respuesta explícita (una plataforma o "None of these"), así que saltarlo no puede ocultar sesiones sin querer. Las respuestas siguen guardando las plataformas a omitir. Las plataformas de proveedor (Microsoft & .NET, SAP, VMware, Oracle, Mainframe) son una dimensión propia de la taxonomía, separada de Migración: conocer migración no significa trabajar con Windows. Una plataforma es *central* en una sesión cuando la nombran su título, un área o un servicio del catálogo, y es una *mención* cuando solo aparece en el abstract. Las sesiones centradas en una plataforma que el asistente marca como no relevante se ocultan; las menciones bajan el puntaje (×0.8) con una razón.

**Puntaje.** `0.30 relevancia + 0.20 nivel + 0.20 irreemplazabilidad + 0.15 profundidad de arquitectura + 0.15 cobertura`, donde la cobertura es cuántas etiquetas que conoces o quieres aprender toca la sesión (6 = completa). La cobertura evita que las sesiones que maximizan todo lo demás empaten en 100%, y los empates se deciden por cobertura. La base de IA solo baja puntajes (×0.55–1), y las relaciones tecnología → tema inferidas exigen que la tecnología aparezca en ese tema en al menos el 60% de sus sesiones (3 o más); las tecnologías de un proveedor específico nunca vienen incluidas con un tema.

**Primero lo que requiere reserva.** Dentro de cada intención, las sesiones que requieren reserva de asiento van antes que las de entrada libre, porque esos lugares se acaban. Según el FAQ de re:Invent 2026, la reserva aplica a bootcamps, builders' sessions, chalk talks, code talks, exam prep, gamified learning, algunos labs y workshops; breakouts, lightning talks y keynotes son de entrada libre. Mientras no abra la reserva, todo el catálogo dice `isReservable: false`, así que se usa la regla por formato; en cuanto alguna sesión venga marcada, manda el dato del catálogo.

**Base de IA (paso bonus).** La IA aparece en el 71% de las sesiones, así que una quinta pregunta mide qué tanto conoce el asistente lo que suponen las charlas de IA: LLMs y prompting, fundamentos de ML, embeddings/RAG, agentes y uso de herramientas, MCP, entrenamiento y MLOps, evaluación y guardrails, GPUs e inferencia, Amazon Bedrock (not yet / some / comfortable; cualquiera se puede omitir). Cada subtema de IA se relaciona con los conocimientos que supone, y el nivel de la sesión define cuánto se espera (100: nada, 200: algo, 300: casi todo, 400: dominio). El ajuste multiplica el puntaje ×0.55–1.1 para que primero salgan las sesiones de IA que el asistente puede aprovechar; con un ajuste menor a 0.35 la sesión se oculta como "supone más base de IA de la que tienes". Los conocimientos sin responder no cuentan.

**Tema → tecnologías y prácticas.** Una tecnología pertenece al tema en que la taxonomía la tiene curada (p. ej. SQS → Integración de aplicaciones) o, si no, al tema principal con el que más aparece en el catálogo; cada tema conserva sus 8 tecnologías más comunes. Una práctica pertenece a un tema cuando aparece al menos 1.5× más en las sesiones de ese tema que en todo el catálogo (lift), hasta 4 por tema; con conteos simples, la IA se quedaría con todas las prácticas. El servidor expande los temas elegidos al armar el plan, así que las respuestas solo guardan temas.

Cada sesión de los formatos elegidos recibe una intención (ver [`src/plan/plan.ts`](../src/plan/plan.ts)):

| Intención | Regla |
|---|---|
| 💪 Reforzar | una etiqueta que conoces es central en la sesión y su tema principal es uno que conoces; se oculta si está dos o más niveles por debajo del tuyo |
| 🌱 Aprender (explícito) | la sesión cubre algo que quieres aprender |
| 🧭 Ampliar | usa lo que sabes en otro tema, o su tema principal es conocido o vecino de uno conocido |
| 🌱 Aprender (inferido) | todo lo demás, solo si no nombraste objetivos de aprendizaje |

**Tu plan de aprendizaje** convierte cada ❤️ en cuatro grupos: lo que **refuerzas** (etiquetas conocidas y tecnologías dentro de un tema conocido), lo que **amplías** (etiquetas nuevas junto a lo que sabes), lo que **aprendes** (tus objetivos y terreno nuevo) y las **habilidades** que desarrollas (conceptos de arquitectura e ingeniería). El comando `reinvent-match match` sigue usando el modelo de perfil de §3.

## 4. Modelo de sesión

La fuente es el objeto `Session` del [AWS Events API](https://docs.aws.amazon.com/events/latest/devguide/what-is-events-api.html) (ver §8). Ya trae casi todo lo necesario, así que la v1 **no necesita LLM** para enriquecer datos.

| Campo Reinvent:Match | Campo del API | Ejemplo real (Summit Dubai 2026) |
|---|---|---|
| `id`, `code` | `sessionId`, `abbreviation` | `AIM201` |
| `title`, `abstract` | `title`, `abstract` | |
| `level` (0–3) | `level` (texto) | `"300 – Advanced"` → 2 · `"No Level"` → sin nivel |
| `format` | `type` | Breakout session, Chalk talk, Workshop, Code talk, Lightning talk… |
| `interaction` | `features` | Lecture-style, Discussion, Hands-on |
| `topics` | `topics` + `areasOfInterest` | Architecture · Agentic AI |
| `services` | `services` | Amazon Bedrock, AWS Lambda |
| `audience` | `roles`, `customerPersonas` | Solution / Systems Architect |
| `schedule` | `sessionTime` (fecha, hora local, minutos), `venue`, `room` | |
| `seats` | `isReservable`, `seatAvailability` | available · limited · veryLimited · unavailable · walkUp |
| `restricted` | `experiences` | "Executive Summit": puede estar restringida |
| `archDepth` (0–3) | derivado | señales de diseño distintas en el texto (trade-offs, fallas, at scale, blast radius, pitfalls, concurrencia/throttling, estructura de cuentas, desacoplamiento, patrones de arquitectura, qué cambia a escala…) + tema Arquitectura; con LLM opcional después |
| `isCustomerStory` | derivado | patrones del título: "How X…", "Lessons learned…" |
| `recorded` | regla por `type` | breakout = probablemente sí; chalk/workshop/builders = no |

**El vocabulario del perfil sale del mismo catálogo:** los temas y servicios que la persona marca como Know, Grow, Explore o Ignore son exactamente los valores de `topics`, `areasOfInterest` y `services`. No hay que inventar ni mantener una taxonomía propia; solo el grafo de temas vecinos para Discovery.

## 5. Motor de match

### 5.1 Nivel adecuado por tema (el núcleo)

Se convierte el nivel de la sesión a la misma escala del dominio: `100→0, 200→1, 300→2, 400→3, 500→3`.

```
stretch = nivel_sesión − dominio_persona   (sobre los temas principales)

stretch ≤ −1  → demasiado básica
stretch =  0  → repaso; sirve solo en 300/400
stretch = +1  → punto ideal
stretch ≥ +2  → demasiado avanzada; conviene una Foundation antes
```

Es la regla *"servicio conocido → 300/400; servicio desconocido → 100/200"*, expresada de forma que se puede calcular.

### 5.2 Evidencia

Cada interés del perfil se busca en la sesión. La fuerza depende de dónde aparece:

| Dónde | Fuerza |
|---|---|
| Etiqueta exacta del catálogo (`services`, `topics`, `areasOfInterest`) | 1.0 |
| Etiqueta que lo contiene ("Architecture" dentro de "Event-Driven Architecture") | 0.9 |
| Título | 0.8 |
| Solo en el abstract | 0.5 |
| Concepto vecino (grafo de temas) | × 0.7 |

**Una mención de pasada en el abstract no alcanza para Deep Dive ni Growth**: si esa es la única evidencia, la sesión queda como Discovery.

### 5.3 Categorías (la UX principal)

Se descartan antes: *breaks*, keynotes (se planean aparte), sesiones restringidas a un programa (`experiences`) y sesiones donde el tema en *Ignore* tiene tanta o más evidencia que el resto. Después se evalúan en este orden y gana la primera que se cumple:

| Categoría | Regla |
|---|---|
| 🔥 **Deep Dive** | tema en *Know* y `stretch ≥ 0`, con nivel ≥ 300 o `stretch ≥ +1` |
| 📚 **Foundation** | tema en *Explore/Grow*, nivel 100/200 y `stretch ≥ 0` |
| 🚀 **Growth** | tema en *Grow* y `stretch ≥ 0` (con advertencia si `stretch ≥ +2`) |
| 🧭 **Discovery** | tema en *Explore*, tema **vecino** de lo que sabes o quieres crecer (`step functions → saga → distributed transactions`), o evidencia solo en el abstract |
| ⏭️ **Skip** | nada de lo anterior; normalmente `stretch ≤ −1` (demasiado básica) |

Las sesiones que no comparten nada con el perfil se marcan como `unrelated` y se ocultan.

> Pendiente para la fase de agenda: que Foundation exija además ser prerrequisito de una sesión con match alto más adelante en la semana.

### 5.4 Porcentaje de match (para ordenar dentro de cada categoría)

```
match = 0.30·alineación_objetivos     (Grow 1.0 · Explore 0.8 · Know 0.6, × fuerza, + bonos por objetivos)
      + 0.25·nivel_adecuado           (stretch +1 → 1.0 · 0 → 0.7 en 300+ / 0.4 · +2 → 0.4 · ≤−1 → 0)
      + 0.20·irreemplazabilidad       (builders/workshop 1.0 · chalk 0.95 · code talk 0.8 · breakout 0.3)
      + 0.15·preferencia_formato      (del perfil; 0.5 si no se indica)
      + 0.10·profundidad_arquitectura (archDepth / 3)
× 0.85 si es sesión patrocinada (-S)
```

Los pesos se pueden cambiar por perfil (`weights`) y son un punto de partida para calibrar, no una verdad.

> Esta fórmula es la del motor `match` de la línea de comandos. La app web calcula con las respuestas del onboarding: ver [SCORING.es.md](SCORING.es.md).

### 5.5 Explicación

Cada componente genera sus propias razones, así el porcentaje nunca aparece sin contexto:

```
🔥 Deep Dive · 92%
✅ Usas Lambda y Step Functions a diario (dominio 3)
✅ Nivel 300: un paso arriba de tu nivel en resiliency
✅ Chalk talk: no se graba, se aprovecha en persona
🎯 Coincide con tu objetivo "rol de arquitectura"
⚠️ Supone conocer multi-region, que marcaste como dominio 1
```

### 5.6 Swipe y aprendizaje

❤️ me interesa · ❌ no para mí · 🔖 guardar. Cada swipe ajusta poco a poco el peso de los temas de la sesión en el perfil (por ejemplo, 8 ❤️ en EKS suben EKS de *Explore* hacia *Grow*). El usuario ve el cambio y puede deshacerlo.

## 6. De candidatas a agenda

```
2,000+ sesiones → filtro Skip/Ignore → ~80 candidatas (match + swipes ❤️)
  → conflictos de horario y traslados → ~30
  → costo de oportunidad + learning paths → ~15 sesiones en la agenda
```

- **Restricciones:** no hay dos sesiones al mismo tiempo; se deja tiempo de traslado cuando cambia el venue (configurable; más si la distancia es larga); no se pasa del máximo de sesiones por día; se respetan los bloques reservados (Expo, Ask the Experts, comida).
- **Costo de oportunidad:** al elegir A se muestra la mejor alternativa perdida: *"Elegiste el workshop de 2h; eso deja fuera 2 chalk talks con 88% y 85%"*.
- **Learning paths:** si una sesión de 72% es Foundation de otra de 95% más adelante en la semana, recibe un bono y se explica por qué.
- **Algoritmo v1:** selección de intervalos ponderada y greedy, con penalización por traslado. Alcanza para ~80 candidatas; si hace falta, se cambia a un solver de restricciones.
- **Distribución sugerida** (editable): 35% arquitectura · 25% profundizar lo conocido · 25% tecnologías nuevas · 15% exploración.

### Capacidad por día (implementado)

Cuántas sesiones caben en un día se calcula con el horario, no es un número fijo. Para cada día Reinvent:Match busca el conjunto más grande de sesiones de la pre-lista (sin las ❌) a las que se puede asistir: dos sesiones son compatibles solo si hay tiempo de llegar de una a otra, y en los días que pasan del mediodía debe caber una comida de 60 minutos entre las 11:00 y las 14:00. Es selección de intervalos con tiempos entre venues, resuelta con programación dinámica para cada posible hora de comida ([`web/src/week.ts`](../web/src/week.ts)). Las ❤️ son bloques fijos; "N left" es cuántas más caben alrededor.

Los tiempos de traslado son **estimaciones** (AWS tiene shuttles pero no publica tiempos): 10 min dentro del mismo venue, 15–30 min entre los venues vecinos del norte del Strip (Venetian, Wynn/Encore, Caesars Forum, Caesars Palace), 40 min hacia o desde MGM Grand y 25 min si no se conoce el venue.

Con el horario de re:Invent 2026, el máximo es de 14–15 sesiones al día con todos los formatos (los lightning talks de 20 minutos se encadenan en el mismo teatro) y de 4–6 al día solo con workshops, builders' sessions, chalk talks y code talks; el viernes permite 3.

## 7. Después del evento (Fase de validación)

Por cada sesión a la que se asistió: ¿cumplió lo esperado? · ¿fue demasiado básica o avanzada? · ¿la repetirías? · ¿el formato ayudó? Con eso se calibran los pesos y las reglas de `stretch`. Esto es lo que convierte *"mi agenda"* en *un método reproducible*.

## 8. Fuente de datos: AWS Events API

API oficial (REST en `https://api.awsevents.com/v1` + servidor MCP en `https://api.awsevents.com/mcp`). La especificación OpenAPI está en `/v1/openapi.json`.

**Qué ofrece**

| Operación | Uso en Reinvent:Match |
|---|---|
| `ListEvents`, `GetEvent` | Elegir el evento (sin credenciales) |
| `ListSessions` (hasta 250 por página, con `nextToken`) | Descargar el catálogo completo: unas 2,200 sesiones son ~9 páginas |
| `GetSchedule` | Leer lo que la persona ya reservó o marcó como favorito |
| `AssociateFavorites` | ❤️ en el swipe → favorito en el portal oficial |
| `CreatePersonalTime` | Bloques de Expo, comida y traslados, directo en la agenda oficial |
| `ReserveSessions` | Reservar la agenda final (desde el 8 de octubre) |

**Restricciones que definen la arquitectura**

1. **Sin opción hosted.** El inicio de sesión es OAuth + PKCE con AWS Builder ID, y el callback **solo acepta loopback en los puertos 8484–8489** (`http://localhost:8484/callback`). La app tiene que correr en la máquina de cada asistente.
2. **El catálogo de re:Invent 2026 no es público.** Para leerlo hay que iniciar sesión *y* estar registrado en el evento. Así que no podemos descargarlo en un servidor y redistribuirlo: cada persona lo lee con su propia sesión.
3. **Los catálogos de eventos sin registro (Summits, Cloud Days) sí son públicos.** Sirven para desarrollar y probar sin credenciales. Ejemplo: `Summit-Dubai-2026`, con 95 sesiones y todos los campos de §4.
4. **El API no busca ni filtra**: descarga todo y filtra del lado del cliente. Eso es justo lo que hace el motor de match.
5. **Cuotas por asistente/minuto:** ListSessions 120 · GetSession 120 · AssociateFavorites y ReserveSessions **30 sesiones** (cada sesión cuenta, no cada request) · CreatePersonalTime 30.
6. **Tokens:** access token de 60 min, refresh token de 30 días. Hay que guardarlos de forma segura y ofrecer cerrar sesión (revocar).
7. **Resultados por sesión:** reservar o marcar favoritos puede fallar en algunas sesiones y funcionar en otras. Después de escribir, siempre hay que confirmar con `GetSchedule`.
8. **Horarios:** `sessionTime` viene en hora local del evento; `PersonalTime` exige **UTC**, redondeado a bloques de 5 minutos.

## 9. Arquitectura propuesta: app local

```
┌──────────────────── máquina del asistente ────────────────────┐
│                                                               │
│  reinvent-match (CLI + UI web en 127.0.0.1:8484)              │
│   ├─ auth      OAuth PKCE Builder ID → ~/.rematch (0600)      │
│   ├─ catalog   ListSessions → caché local (JSON) + ETag/fecha │
│   ├─ profile   perfil.json (Know/Grow/Explore/Ignore)         │
│   ├─ match     reglas + scoring + explicaciones               │
│   ├─ agenda    conflictos, traslados, costo de oportunidad    │
│   └─ sync      ❤️→AssociateFavorites · bloques→PersonalTime   │
│                agenda final→ReserveSessions → GetSchedule     │
│                                                               │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS (token del propio asistente)
                ▼
      api.awsevents.com  ·  oauth.awsevents.com
```

- **Por qué un servidor local y no una página web que llame al API:** las lecturas del catálogo sin sesión aceptan cualquier origen (`Access-Control-Allow-Origin: *`), pero la petición previa de CORS para llamadas con `Authorization` devuelve `404`, y el endpoint de tokens solo acepta el origen `127.0.0.1:8484`. Las llamadas con sesión tienen que salir de un proceso local. La interfaz le habla al servidor local (`/api/...`), que guarda el token y llama al AWS Events API; el token nunca llega al navegador.
- **Protección del servidor local:** solo escucha en `127.0.0.1`, rechaza cualquier `Host` distinto de `127.0.0.1:<puerto>`/`localhost:<puerto>` (DNS rebinding) y exige el header `X-Rematch` en toda escritura (otros sitios web no pueden mandarlo sin una petición previa de CORS que el servidor nunca aprueba).
- **Nada sale de la máquina**: el perfil, los swipes y el catálogo se quedan en local. Resuelve privacidad y cumple con que el catálogo no es público.
- **Distribución:** paquete npm en TypeScript (`npx reinvent-match`) que abre la UI de swipe en el navegador, en `localhost:8484`, el mismo puerto del callback.
- **Complemento MCP (Fase 2b):** exponer `reinvent-match` como servidor MCP local (`match_sessions`, `explain_match`, `build_agenda`) para que un asistente (Claude Code, Kiro) lo combine con el MCP oficial `awsevents`. El scoring de 2,200 sesiones se hace en código, no en el contexto del LLM.
- **LLM opcional:** convertir un perfil escrito en texto libre en `perfil.json` y mejorar `archDepth`. Se hace con la cuenta o el asistente del propio usuario, nunca en un backend nuestro.
- **Si más adelante hay backend** (por ejemplo, para calibrar pesos con la retroalimentación del evento), solo recibe datos anónimos y voluntarios de la Fase 3, nunca el catálogo.

## 10. Plan por fases

re:Invent 2026: **30 nov – 4 dic**, Las Vegas. La reserva de asientos abre el **6 de octubre** en el portal y el **8 de octubre** en el API (antes de esa fecha, reservar devuelve `409`; leer el catálogo y marcar favoritos ya funciona). La entrega del hackatón es el **6 de noviembre**; el calendario detallado y la cobertura del API están en [HACKATHON.es.md](HACKATHON.es.md).

| Fase | Fecha objetivo | Entregable | Por qué |
|---|---|---|---|
| **0 · Método** | ✅ 24 sep | Este documento | Sin un método sólido, el código no sirve |
| **1 · Motor con datos públicos** | ✅ 24 sep | CLI: `reinvent-match match Summit-Dubai-2026 --profile perfil.json` → candidatas con categoría y razones. Grafo de temas vecinos. Pruebas con catálogos de Summits | Calibrar reglas sin necesitar credenciales |
| **1b · Tu re:Invent** | 3 oct | Sign-in con Builder ID + catálogo `reinvent2026` + tu perfil → candidatas; swipe en terminal; ❤️ → favoritos oficiales | Tener tu shortlist **antes** del 6 de octubre |
| **2 · Agenda + reserva** | 6–8 oct | Conflictos, traslados, costo de oportunidad → agenda → `CreatePersonalTime` + `ReserveSessions` con confirmación | Reservar el día que abre |
| **2b · UI de swipe + MCP** | oct–nov | UI local en `localhost:8484`, paquete instalable, servidor MCP | Que lo usen otros first-timers antes del evento |
| **3 · Validación** | dic | Encuesta después de cada sesión + recalibración | Hace el método reproducible |
| **4 · Contenido** | dic–ene | Post de Community Builder: *"2,000+ sessions: how I built my personal learning path"* | Difusión |

## 11. Riesgos y preguntas abiertas

1. **Ventana de tiempo muy corta.** Si la Fase 1b no está lista el 3 de octubre, el plan B es usar el motor para generar la shortlist y reservar a mano en el portal el 6 de octubre.
2. **Sesiones sin nivel o con tags pobres** (`"No Level"`, `services` vacío): hacer fallback a `topics` y `areasOfInterest` y bajar la confianza del match (mostrarlo en la explicación).
3. **Reserva automática.** Reservar tiene efectos reales (asientos limitados, choques de horario). Reinvent:Match nunca reserva sin que la persona confirme la lista final, y después verifica con `GetSchedule`.
4. **Tokens.** Se guardan en `~/.rematch/credentials.json`, que solo puede leer el dueño (0600); pasarlos al keychain del sistema operativo es una mejora posterior. `reinvent-match logout` revoca el refresh token y `--browser` también cierra la sesión de Builder ID.
5. **Nombre y marca.** "Reinvent:Match" juega con una marca de AWS: aclarar que es no oficial y revisar las guías de marca.
6. **Alcance.** El API cubre re:Invent, Summits y otros eventos de AWS, así que el modelo es genérico desde el inicio sin costo extra.
