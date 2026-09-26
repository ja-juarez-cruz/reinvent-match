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

1. **Perfil.** Acomodas temas y servicios en cuatro grupos: 🟢 *Know*, 🟡 *Grow*, 🔵 *Explore* y ⚪ *Ignore*, cada uno con un dominio de 0 a 3.
2. **Nivel adecuado.** Para cada sesión, `stretch = nivel de la sesión − tu dominio`. Los niveles comparten una escala (Basic ↔ 200, Intermediate ↔ 300, Advanced ↔ 300 y 400, lo que el catálogo llama "Advanced" y "Expert"): una sesión de tu nivel es el paso siguiente a lo que ya sabes y obtiene el mayor puntaje; un nivel más arriba es un reto; por debajo, se descarta. Si el título nombra una tecnología de un tema que conoces menos que el tema del track ("GitOps on Amazon EKS" en el track de open source), decide ese tema.
3. **Categorías.** Cada sesión cae en 🔥 Deep Dive, 🚀 Growth, 📚 Foundation, 🧭 Discovery o ⏭️ Skip.
4. **Orden.** Dentro de cada categoría, las sesiones se ordenan por alineación con tus objetivos, nivel adecuado, *irreemplazabilidad* (chalk talks y workshops por encima de breakouts que se graban), preferencia de formato y profundidad de arquitectura.

El diseño completo está en [docs/CONCEPT.es.md](docs/CONCEPT.es.md). Se construye para el hackatón del AWS Events API: ver [docs/HACKATHON.es.md](docs/HACKATHON.es.md).

## Inicio rápido

Requiere Node.js 20+.

```bash
npx reinvent-match
```

Eso descarga el paquete de npm y abre Reinvent:Match en tu navegador. Desde un clon de este repositorio:

```bash
npm install
npm run ui
```

En ambos casos la app se abre en `http://127.0.0.1:8484`. Todo corre en tu máquina:

1. **Evento:** eliges re:Invent (inicias sesión con tu AWS Builder ID) o el catálogo público de un Summit en el carrusel. Cada tarjeta muestra cuántas sesiones tienes y qué tan recientes son; su ↻ descarga el catálogo más reciente (⤓ la primera vez). Las sesiones nuevas se etiquetan solas y tus swipes se conservan.
   **Insights:** cada sesión etiquetada en nueve dimensiones (tema, tecnología, audiencia, estilo de aprendizaje, tipo de contenido, concepto, nivel…) con gráficas para ir al detalle. Ver [docs/TAXONOMY.es.md](docs/TAXONOMY.es.md).
2. **Sobre ti (una sola vez):** justo después de tu primer inicio de sesión, cinco pasos; quedan en tu perfil y puedes cambiarlos cuando quieras desde 👤 → ⚙️ Preferences. (1) Hasta 8 temas que quieres aprender o profundizar; cada uno trae sus tecnologías y prácticas (p. ej. Serverless → Lambda, Step Functions, API Gateway, event-driven). (2) Tu nivel en cada tema: New to me (aprenderlo), Basic, Intermediate o Advanced (profundizar: Basic apunta a sesiones 200, Intermediate a 300, Advanced a 400). (3) Las plataformas con las que trabajas (Microsoft & .NET, SAP, VMware, Oracle, Mainframe, o ninguna): se omiten las sesiones centradas en las demás. (4) Tu base de IA: la mayoría de las sesiones involucran IA, así que esto encuentra las sesiones de IA que de verdad puedes aprovechar. (5) Los formatos que quieres (uno, varios o todos).
3. **Swipe:** tu pre-lista dividida en 💪 **Reforzar** (lo que sabes, a tu nivel o más arriba), 🧭 **Ampliar** (lo que sabes, llevado a temas vecinos) y 🌱 **Aprender** (temas nuevos a un nivel de entrada adecuado para ti). Dentro de cada sección, primero van las sesiones de tu nivel y, entre ellas, las que requieren 🎟 reserva de asiento, porque esos lugares se acaban. Los temas nuevos dos niveles arriba de donde puedes empezar se omiten; las sesiones centradas en IA que asumen más IA de la que marcaste se ocultan, y las que solo tocan IA solo bajan de lugar. Las tarjetas llegan en tres etapas para que el calendario se llene rápido: primero solo las sesiones que caben con tus elegidas, la comida y los traslados (las que aún no tienen horario van al final); cuando ya no cabe nada más, hasta dos alternativas por cada elegida, para intercambiarla, quedarte con ambas o con la tuya; después, solo si lo pides, el resto de las que chocan. Cada tarjeta dice por qué. ← no es para mí · ↓ quizá · → me interesa · U deshacer. Arriba, **tu semana**: cada día muestra cuántas sesiones más caben, calculado con el horario real (el máximo de sesiones de tu pre-lista a las que puedes asistir con 60 minutos de comida y tiempo de traslado entre venues), marca los días donde tus elegidas se enciman o están demasiado lejos para llegar a tiempo, avisa si no te dejan hueco para comer, te deja hacer clic en un día para revisar solo sus sesiones y te avisa cuando un día se llena, con la opción de seguir revisándolo o pasar al día siguiente y resalta el día de la tarjeta actual, que además avisa si choca con alguna elegida o cae en un día lleno. Al hacer clic en el código de una sesión que choca, se abre y puedes intercambiarla en un clic (❤️ a la tarjeta actual y la otra queda como 🔖 respaldo).
4. **❤️ My Match:** tu semana por hora, con los días en columnas: la sesión a la que vas en cada horario, la comida y hasta dos alternativas a la misma hora (primero tus 🔖 quizá), cada una a un clic de intercambiarla (❤️ a la alternativa y tu elegida queda como 🔖 respaldo). Los choques se marcan; abajo se listan los 🔖 quizá que caben en tu tiempo libre y las sesiones que aún no tienen horario. Al lado, **Tu plan de aprendizaje** se llena con cada ❤️: qué vas a reforzar, ampliar y aprender, las habilidades que vas a desarrollar, horas, sesiones hands-on y choques. Un clic manda tus ❤️ a tus favoritos oficiales de re:Invent.

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

## Revisar las recomendaciones con perfiles

`test/personas/` tiene perfiles de prueba (preventa, arquitecto principal, principiante total, data engineer, especialista en seguridad, engineering manager, ML engineer), cada uno con sus respuestas del onboarding y lo que un revisor debería ver. `npm run personas` arma, para cada uno, la pre-lista, qué se oculta y por qué, las primeras tarjetas de cada pestaña con sus razones, una semana llenada como la llena la app y banderas automáticas, en `~/.rematch/reports/personas-<evento>.html` (fuera del repositorio, porque contiene datos del catálogo). Dale la sección de un perfil a alguien con ese perfil, o a un agente revisor, y pregúntale qué está mal para él, qué falta y qué razones no se sostienen; lo que se confirme se vuelve prueba.

## Roadmap

- [x] Motor de match con catálogos públicos
- [x] Inicio de sesión con Builder ID (OAuth PKCE en `127.0.0.1:8484`)
- [ ] Catálogo `reinvent2026` calibrado con un perfil real
- [x] App web local: editor de perfil, swipe, My Match
- [x] Swipe ❤️ → favoritos oficiales
- [ ] Agenda: conflictos, traslados entre venues, costo de oportunidad, tiempo personal
- [ ] Reservas con confirmación explícita (desde el 8 de octubre de 2026)
- [ ] UI de swipe local y servidor MCP
