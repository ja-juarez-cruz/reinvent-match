# Reinvent:Match

🇬🇧 [English version](README.md)

**Un Tinder de persona ↔ sesión.** AWS re:Invent tiene más de 2,000 sesiones. Reinvent:Match no te dice cuáles son *las mejores*, sino cuáles *encajan contigo*, según lo que ya sabes, lo que quieres profundizar y lo que quieres explorar. Cada recomendación explica por qué.

> Proyecto comunitario no oficial, sin afiliación con AWS. Usa el [AWS Events API](https://docs.aws.amazon.com/events/latest/devguide/what-is-events-api.html) oficial.

```
🔥 Deep Dive
   79%  ARC401     The Shapeshifting Application: Architecture That Transforms Across AWS
        Code talk · 400 – Expert · 2026-09-30 15:15 · Floor 0, Code Talks
        ✅ About "AWS Lambda" (you know it), tagged "AWS Lambda".
        ℹ️  Level 400 matches your proficiency in "AWS Lambda" (advanced); expect depth, not new ground.
        ✅ Code talk: interactive and hard to get outside the event.
        ✅ Discusses design trade-offs (architecture depth 2/3), aligned with your architecture goal.
```

La herramienta (comandos, salida y código) está en inglés; la documentación está en inglés y en español.

## Cómo funciona

1. **Sobre ti.** Hasta 8 temas con tu nivel en cada uno, las plataformas con las que trabajas, tu base de IA y los formatos que quieres, o empieza desde los favoritos que ya tienes en la app AWS Events.
2. **Filtro.** Se omiten los formatos que no elegiste, las sesiones centradas en plataformas que no usas, las sesiones de IA que asumen más de tu base y las que están dos niveles arriba del tuyo.
3. **Tres pestañas.** 💪 **Reforzar** lo que sabes a tu nivel, 🧭 **Ampliar** hacia temas vecinos, 🌱 **Aprender** temas nuevos a un nivel de entrada adecuado para ti.
4. **Porcentaje de match.** Relevancia para tus temas, nivel adecuado *en ese tema* (Basic ↔ 200, Intermediate ↔ 300, Advanced ↔ 300/400), *irreemplazabilidad* (hands-on y chalk talks por encima de breakouts), profundidad de arquitectura y cobertura de tus tags; luego ajustes por patrocinio, plataformas e IA, y un pequeño bono por asiento reservado y por parecerse a tus ❤️. Ejemplos con los puntos: [docs/SCORING.es.md](docs/SCORING.es.md).
5. **Tu semana.** El swipe llena primero el calendario (con comida y traslados entre venues), y después My Match resuelve choques, llena el tiempo libre y reserva asientos en orden.

El diseño completo está en [docs/CONCEPT.es.md](docs/CONCEPT.es.md). Se construye para el hackatón del AWS Events API: ver [docs/HACKATHON.es.md](docs/HACKATHON.es.md).

## Inicio rápido

**Con Node.js 20+:**

```bash
npx reinvent-match
```

**Sin Node:** descarga la versión para tu sistema desde el [último release](https://github.com/ja-juarez-cruz/reinvent-match/releases/latest) (macOS Apple silicon o Intel, Windows, Linux x64 o ARM), descomprímela y ábrela. Todavía no están firmadas, así que la primera vez:

- **macOS:** clic derecho sobre el archivo → **Abrir** → **Abrir** (o corre una vez `xattr -d com.apple.quarantine reinvent-match-macos-*` en la Terminal).
- **Windows:** en "Windows protegió tu PC", haz clic en **Más información** → **Ejecutar de todas formas**.
- **Linux:** `chmod +x reinvent-match-linux-*` y ejecútalo.

Eso descarga el paquete de npm y abre Reinvent:Match en tu navegador. Desde un clon de este repositorio:

```bash
npm install
npm run ui
```

En ambos casos la app se abre en `http://127.0.0.1:8484`. Todo corre en tu máquina:

1. **Evento:** eliges re:Invent (inicias sesión con tu AWS Builder ID) o el catálogo público de un Summit en el carrusel. Cada tarjeta muestra cuántas sesiones tienes y qué tan recientes son; su ↻ descarga el catálogo más reciente (⤓ la primera vez). Las sesiones nuevas se etiquetan solas y tus swipes se conservan.
   **Insights:** cada sesión etiquetada en nueve dimensiones (tema, tecnología, audiencia, estilo de aprendizaje, tipo de contenido, concepto, nivel…) con gráficas para ir al detalle. Ver [docs/TAXONOMY.es.md](docs/TAXONOMY.es.md).
2. **Sobre ti (una sola vez):** justo después de tu primer inicio de sesión, cinco pasos (si ya tienes favoritos en la app AWS Events, **⭐ Use my favorites** los llena a partir de esas sesiones, y tus favoritos pasan a ser tus primeras ❤️); quedan en tu perfil y puedes cambiarlos cuando quieras desde 👤 → ⚙️ Preferences. (1) Hasta 8 temas que quieres aprender o profundizar; cada uno trae sus tecnologías y prácticas (p. ej. Serverless → Lambda, Step Functions, API Gateway, event-driven). (2) Tu nivel en cada tema: New to me (aprenderlo), Basic, Intermediate o Advanced (profundizar: Basic apunta a sesiones 200, Intermediate a 300, Advanced a 400). (3) Las plataformas con las que trabajas (Microsoft & .NET, SAP, VMware, Oracle, Mainframe, o ninguna): se omiten las sesiones centradas en las demás. (4) Tu base de IA: la mayoría de las sesiones involucran IA, así que esto encuentra las sesiones de IA que de verdad puedes aprovechar. (5) Los formatos que quieres (uno, varios o todos).
3. **Swipe:** tu pre-lista dividida en 💪 **Reforzar** (lo que sabes, a tu nivel o más arriba), 🧭 **Ampliar** (lo que sabes, llevado a temas vecinos) y 🌱 **Aprender** (temas nuevos a un nivel de entrada adecuado para ti). Dentro de cada sección, primero van las sesiones de tu nivel, por puntaje; requerir 🎟 reserva de asiento suma un poco, porque esos lugares se acaban, y las patrocinadas nunca van al frente. Reinforce reparte esas primeras tarjetas tema por tema (dos por ronda para un tema Advanced), para que las sesiones que tocan muchos temas a la vez no desplacen a los tuyos. Los temas nuevos dos niveles arriba de donde puedes empezar se omiten; las sesiones de IA que asumen más IA de la que marcaste se ocultan, y las que solo tocan IA solo bajan de lugar. Las tarjetas llegan en tres etapas para que el calendario se llene rápido: primero solo las sesiones que caben con tus elegidas, la comida y los traslados (las que aún no tienen horario van al final); cuando ya no cabe nada más, hasta dos alternativas por cada elegida, para intercambiarla, quedarte con ambas o con la tuya; después, solo si lo pides, el resto de las que chocan. Cada tarjeta dice por qué, incluidas las sesiones parecidas a tus ❤️: dos elecciones que comparten una tecnología específica fuera de tus temas más fuertes (Amazon ECS con Contenedores en Basic) suben las sesiones parecidas. ← no es para mí · ↓ quizá · → me interesa · U deshacer. Arriba, **tu semana**: cada día muestra cuántas sesiones más caben, calculado con el horario real (el máximo de sesiones de tu pre-lista a las que puedes asistir con 60 minutos de comida y tiempo de traslado entre venues), marca los días donde tus elegidas se enciman o están demasiado lejos para llegar a tiempo, avisa si no te dejan hueco para comer, te deja hacer clic en un día para revisar solo sus sesiones, marca los días llenos y resalta el día de la tarjeta actual, que además avisa si choca con alguna elegida o cae en un día lleno. Al hacer clic en el código de una sesión que choca, se abre y puedes intercambiarla en un clic (❤️ a la tarjeta actual y la otra queda como 🔖 respaldo).
4. **❤️ My Match:** tu semana por hora, con los días en columnas. Cada tarjeta empieza con su pestaña (💪 Reinforce, 🧭 Broaden, 🌱 Learn) y su horario; los filtros ❤️ Interested, 🔖 Maybe y ❌ Not for me eligen qué muestra el calendario: agrega Maybe para resolver los traslapes entre tus elegidas y tus respaldos lado a lado, o muestra Not for me para quitarle esa marca a una sesión. Muestra la sesión a la que vas en cada horario, la comida y, plegadas bajo cada elegida hasta que las abras, hasta dos alternativas a la misma hora (primero tus 🔖 quizá), cada una a un clic de intercambiarla (❤️ a la alternativa y tu elegida queda como 🔖 respaldo). También se marca el tiempo libre entre sesiones (☕, ya descontado el traslado al siguiente venue y aparte de la comida), con para qué sirve: la Expo y los stands de partners, el hallway track o un respiro. Los traslados entre venues aparecen entre sesiones seguidas (🚶 10:00 → MGM Grand · 40 min walk, en naranja si no alcanza el tiempo), los choques dicen por qué (⚠️ Overlaps o 🚶 Too far from…), y al hacer clic en el código del choque, o en una sesión elegida en dos horarios, se abre un solucionador: quedarte con una (la otra pasa a 🔖 respaldo), mover una a otro horario en que se ofrece (con aviso si ahí también choca) o conservar ambas; abajo se listan los 🔖 quizá que caben en tu tiempo libre y las sesiones que aún no tienen horario. Al lado, **Tu plan de aprendizaje** se llena con cada ❤️: qué vas a reforzar, ampliar y aprender, las habilidades que vas a desarrollar, horas, sesiones hands-on y choques. **✨ Fill my week** sugiere sesiones para el tiempo libre alrededor de tus elegidas (primero tus 🔖 quizá, luego tus mejores coincidencias a tu nivel; nunca patrocinadas ni debajo de 65%) para agregarlas de una vez. La vista **🎟 Reservations** lista tus ❤️ que requieren asiento en el orden para reservarlas cuando abra la reserva: primero las que se ofrecen una sola vez, luego las hands-on, que se llenan más rápido, cada una con un respaldo (otro horario de la misma sesión o un quizá a la misma hora), una casilla de reservada y un botón para copiar la lista. Con sesión iniciada, **🎟 Reserve N in this order** las reserva por el API de AWS Events (ReserveSessions, de diez en diez, a partir del 8 de octubre), muestra el resultado de cada sesión (reservada, llena, choque…), ofrece reservar un respaldo cuando una sesión está llena (el respaldo pasa a ser la ❤️), marca con ✓ cada reserva que el evento confirma, incluidas las hechas en el portal, y permite cancelar una (CancelReservation). **↻ Check seats** muestra qué tan llena está cada sesión por reservar (GetSession: disponible, limitada, muy limitada, llena). **📅 Calendar** manda a tu agenda de re:Invent, como tiempo personal, la comida, los traslados entre venues y el tiempo libre planeados alrededor de tus elegidas (al volver a sincronizar solo mueve o quita los bloques que agregó), y descarga tus elegidas y esos bloques en un archivo .ics para el calendario de tu teléfono. Un clic manda tus ❤️ a tus favoritos oficiales de re:Invent, y **⬇ Import from re:Invent** trae lo que cambiaste allá (en el portal, la app AWS Events o su asistente de IA): los favoritos nuevos pasan a ❤️ y los que quitaste a 🔖, después de revisar la diferencia. Una sesión que elegiste nunca se oculta por tus preferencias.

Tus datos se quedan en `~/.rematch/` (tokens que solo tú puedes leer, catálogos, perfiles y swipes).

### Línea de comandos

```bash
npm run dev -- events                                   # lista los eventos de AWS
npm run dev -- fetch Summit-Dubai-2026                  # catálogo público, sin iniciar sesión
npm run dev -- vocab Summit-Dubai-2026                  # etiquetas que puedes usar en tu perfil
npm run dev -- match Summit-Dubai-2026 -p examples/profile.example.json --explain
```

Opciones de `match`:

| Opción | Descripción |
|---|---|
| `-p, --profile <archivo>` | JSON del perfil ([ejemplo](examples/profile.example.json)) |
| `-c, --category <lista>` | `deep-dive,growth,foundation,discovery,skip` |
| `-n, --top <n>` | Sesiones por categoría (10 por defecto) |
| `-e, --explain` | Muestra las razones de cada match |
| `--json` | Salida para otras herramientas |

### re:Invent 2026

El catálogo de re:Invent solo lo pueden leer asistentes registrados. Primero inicia sesión con tu AWS Builder ID:

```bash
npm run dev -- login                    # abre el navegador; callback en 127.0.0.1:8484
npm run dev -- schedule reinvent2026    # verifica el acceso: tus reservas y favoritos
npm run dev -- fetch reinvent2026
npm run dev -- match reinvent2026 -p mi-perfil.json --explain
npm run dev -- logout --browser         # revoca los tokens y cierra la sesión de Builder ID
```

Los tokens se guardan en `~/.rematch/credentials.json` (solo tú puedes leerlo) y se renuevan solos. El catálogo descargado queda en `~/.rematch/cache/`, fuera del repositorio: el catálogo de re:Invent no es público y nunca debe subirse al repo.

## Desarrollo

```bash
npm test          # tests unitarios + regresión contra una copia de un catálogo público
npm run typecheck
npm run build     # genera dist/ con el binario `reinvent-match` y la interfaz compilada
npm pack          # el paquete que publicaría npm (solo instala zod como dependencia)
npm publish       # antes corre typecheck, tests y build (prepublishOnly)
```

Para probar la vista de reservas antes de que abra la reserva de asientos, arranca la app con asientos inventados.
Aparece cada nivel de disponibilidad por turnos, y reservar o cancelar funciona en memoria, sin llamar al Events API.
Apunta `REMATCH_HOME` a una copia de `~/.rematch` para no tocar tus datos:

```bash
REMATCH_HOME=/tmp/rematch-demo REMATCH_DEMO_SEATS=1 npx tsx src/cli.ts ui
```

## Revisar las recomendaciones con perfiles

`test/personas/` tiene perfiles de prueba (preventa, arquitecto principal, principiante total, data engineer, especialista en seguridad, engineering manager, ML engineer), cada uno con sus respuestas del onboarding y lo que un revisor debería ver. `npm run personas` arma, para cada uno, la pre-lista, qué se oculta y por qué, las primeras tarjetas de cada pestaña con sus razones, una semana llenada como la llena la app y banderas automáticas, en `~/.rematch/reports/personas-<evento>.html` (fuera del repositorio, porque contiene datos del catálogo). Dale la sección de un perfil a alguien con ese perfil, o a un agente revisor, y pregúntale qué está mal para él, qué falta y qué razones no se sostienen; lo que se confirme se vuelve prueba.

## Roadmap

- [x] Motor de match con catálogos públicos
- [x] Inicio de sesión con Builder ID (OAuth PKCE en `127.0.0.1:8484`)
- [x] App web local: Sobre ti, swipe, My Match, plan de aprendizaje
- [x] Recomendaciones revisadas con siete perfiles de prueba
- [x] Favoritos en ambos sentidos: ❤️ → favoritos oficiales, e importar lo que cambió en el portal o la app AWS Events
- [x] Tu semana: choques y cómo resolverlos, traslados entre venues, comida, tiempo libre, ✨ Fill my week
- [x] Plan de reserva y reservas por el API, con respaldos para las sesiones llenas
- [x] Ejecutables para macOS, Windows y Linux (sin instalar Node)
- [ ] Catálogo `reinvent2026` calibrado con un perfil real
- [ ] Primeras reservas reales contra el API (la escritura abre el 8 de octubre de 2026)
- [ ] Tiempo personal para los traslados entre venues (Create / Update / DeletePersonalTime)
- [ ] Vigilante de asientos para sesiones llenas (GetSession)
- [ ] Servidor MCP junto al servidor oficial `awsevents`
