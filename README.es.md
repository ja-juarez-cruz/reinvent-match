# Re:Match

🇬🇧 [English version](README.md)

**Un Tinder de persona ↔ sesión.** AWS re:Invent tiene más de 2,000 sesiones. Re:Match no te dice cuáles son *las mejores*, sino cuáles *encajan contigo*, según lo que ya sabes, lo que quieres profundizar y lo que quieres explorar. Cada recomendación explica por qué.

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
2. **Nivel adecuado.** Para cada sesión, `stretch = nivel de la sesión − tu dominio`. Lo ideal es un paso arriba de lo que sabes; por debajo, se descarta.
3. **Categorías.** Cada sesión cae en 🔥 Deep Dive, 🚀 Growth, 📚 Foundation, 🧭 Discovery o ⏭️ Skip.
4. **Orden.** Dentro de cada categoría, las sesiones se ordenan por alineación con tus objetivos, nivel adecuado, *irreemplazabilidad* (chalk talks y workshops por encima de breakouts que se graban), preferencia de formato y profundidad de arquitectura.

El diseño completo está en [docs/CONCEPT.es.md](docs/CONCEPT.es.md). Se construye para el hackatón del AWS Events API: ver [docs/HACKATHON.es.md](docs/HACKATHON.es.md).

## Inicio rápido

Requiere Node.js 20+.

```bash
npm install
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

El catálogo de re:Invent solo lo pueden leer asistentes registrados. El inicio de sesión con Builder ID (`rematch login`) está en desarrollo. Mientras tanto, si defines la variable de entorno `REMATCH_ACCESS_TOKEN`, `fetch` usa ese token.

## Desarrollo

```bash
npm test          # tests unitarios + regresión contra una copia de un catálogo público
npm run typecheck
npm run build     # genera dist/ con el binario `rematch`
```

## Roadmap

- [x] Motor de match con catálogos públicos
- [ ] Inicio de sesión con Builder ID (OAuth PKCE en `localhost:8484`) y catálogo `reinvent2026`
- [ ] Swipe ❤️ → favoritos oficiales
- [ ] Agenda: conflictos, traslados entre venues, costo de oportunidad, tiempo personal
- [ ] Reservas con confirmación explícita (desde el 8 de octubre de 2026)
- [ ] UI de swipe local y servidor MCP
