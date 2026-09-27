# Cómo se calcula el porcentaje de match

🇬🇧 [English version](SCORING.md)

Cada sesión recibe cinco puntajes de 0 a 1. Cada uno se multiplica por su peso, luego se aplican unos ajustes y el resultado es el porcentaje de la tarjeta (con tope de 100%). El código está en [`src/plan/plan.ts`](../src/plan/plan.ts).

## La fórmula

| Componente | Qué mide | Peso* |
|---|---|---|
| **Relevancia** | Qué tan de lleno toca tus temas: tema principal 1.0 · tecnología 0.9 · práctica 0.7 · tema secundario 0.6, +0.08 por cada tag tuyo adicional (máx. 1.0), ×0.75 si es un tema lejano | 30 |
| **Nivel** | Nivel de la sesión contra tu nivel *en ese tema* (Basic → 200, Intermediate → 300, Advanced → 300/400): en tu nivel 1.0 · uno arriba 0.6 · uno abajo 0.5 · más lejos 0.3 | 20 |
| **Formato** | Lo que solo da el evento: hands-on 1.0 · chalk talk 0.95 · code talk 0.8 · breakout / exam prep 0.75 | 20 |
| **Profundidad** | Señales de arquitectura en la descripción (trade-offs, modos de falla, escala), de 0 a 3 | 15 |
| **Cobertura** | Cuántos de tus tags toca (6 o más es completa) | 15 |

\* Si Architecture está entre tus temas. Si no, la relevancia pesa 40 y la profundidad 5.

Después, en este orden:

1. **Multiplicadores:** patrocinada ×0.7 · menciona una plataforma que no usas ×0.8 · asume más IA de la que marcaste ×0.55–1.0.
2. **Bonos:** requiere asiento reservado +3 · cada ❤️ tuyo que comparte una tecnología específica +3 (máx. +9) · historia de cliente +2.
3. **Tope:** 100% en pantalla. El orden usa el puntaje sin tope, así que dos sesiones de 100% igual quedan ordenadas.

Antes de calcular, tus respuestas también **filtran**: se omiten los formatos que no elegiste, las sesiones centradas en una plataforma que no usas, las sesiones de IA que asumen una base que no tienes y los niveles dos o más pasos arriba del tuyo.

## Ejemplos con números

Catálogo público de AWS Summit Dubai 2026 (95 sesiones) con un perfil de ejemplo: Intermediate en Networking, Serverless, Observability, Security, Developer tools y Migration; Basic en Containers y Architecture; base de IA "Some"; solo formatos hands-on e interactivos. El filtro de formato quita 72 sesiones, otras reglas quitan 4 y quedan 19.

| Sesión | Relevancia | Nivel | Formato | Profundidad | Cobertura | Base | Ajustes | **Match** |
|---|---|---|---|---|---|---|---|---|
| **CDN301** ELB cookbook: advanced recipes for ALB and NLB · chalk talk 300 | 30 | 20 | 19 | 10 | 12.5 | 91.5 | asiento +3 | **95%** |
| **DVT305** Exploit a software vulnerability, then stop it · workshop 300 | 30 | 20 | 20 | 0 | 7.5 | 77.5 | asiento +3 | **81%** |
| **ARC401** The Shapeshifting Application · code talk 400 | 30 | **6** | 16 | 10 | 12.5 | 74.5 | asiento +3 | **78%** |
| **AIM302** Build an Agent Factory · code talk 300 | **18** | 20 | 16 | 10 | **0** | 64.0 | IA ×0.83, asiento +3 | **56%** |
| **TNC203** AWS Certified Solutions Architect - Associate · exam prep 200 | **13.5** | 16 | **15** | 0 | 2.5 | 47.0 | asiento +3 | **50%** |
| **ANT301** Bridging data with generative AI agents · code talk 300 | **13.5** | 20 | 16 | 0 | **0** | 49.5 | IA ×0.83, asiento +3 | **44%** |

Por qué cada una queda donde queda:

- **CDN301, 95%.** Networking es su tema principal, 300 corresponde a Intermediate, es un formato de discusión y habla de diseño (profundidad 2/3). Toca 5 de tus tags; con uno más llegaría a 100%.
- **DVT305, 81%.** Tema, nivel y formato correctos, pero sin profundidad de arquitectura y solo con 3 de tus tags.
- **ARC401, 78%.** Tema perfecto con el nivel equivocado: 400 está dos pasos arriba de tu Basic en Architecture, así que el nivel aporta 6 de 20 puntos.
- **AIM302, 56%.** IA es vecino de tus temas, pero no toca ninguno de tus tags. Es una sesión de IA de nivel 300 y tu base "Some" cubre el 62% de lo que asume, así que ×0.83.
- **TNC203, 50%.** Architecture solo aparece como tema secundario de una sesión de certificación (lejana, ×0.75), y el exam prep puntúa 0.75 en formato.
- **ANT301, 44%.** Analytics no es uno de tus temas ni está junto a ellos, no toca tus tags y asume base de IA.

Con el catálogo completo de re:Invent, el mismo perfil conserva unas 1,060 de más de 2,000 sesiones. Ahí aparecen dos ajustes más: una sesión de migración que menciona Mainframe baja de 98% a 79% (×0.8), y una sesión de ECS de nivel 300 llega a 100% aunque Containers está en Basic, porque dos ❤️ en Amazon ECS suman +6.

## Orden en cada pestaña

El porcentaje no es el único criterio de orden. En 💪 Reinforce, 🧭 Broaden y 🌱 Learn, las sesiones de tu nivel siempre van primero, y luego se ordenan por puntaje sin tope. Además, Reinforce reparte sus primeras tarjetas tema por tema, para que las sesiones que tocan muchos temas a la vez no desplacen a ninguno de tus temas.
