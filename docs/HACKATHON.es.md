# Plan del hackatón

🇬🇧 [English version](HACKATHON.md)

Re:Match se construye para el hackatón del AWS Events API. Fecha límite de entrega: **6 de noviembre de 2026, 11:59 PM PT**.

## Criterios de evaluación → qué aporta Re:Match

Cuatro criterios con el mismo peso (25% cada uno):

| Criterio | Cómo lo cubre Re:Match |
|---|---|
| **Creatividad y novedad de la integración** | Match persona ↔ sesión en lugar de un buscador. Categorías explicadas (Deep Dive, Growth, Foundation, Discovery, Skip), *irreemplazabilidad* de los formatos presenciales, learning paths a lo largo de la semana y costo de oportunidad de cada elección. Un servidor MCP local que **se combina con** el MCP oficial `awsevents`: el asistente usa el nuestro para decidir y el oficial para actuar. |
| **Utilidad para asistentes de re:Invent** | Pensado para el 47% que va por primera vez: convierte 2,000+ sesiones en ~15 con razones, evita sesiones demasiado básicas o avanzadas y lleva la agenda al portal oficial (favoritos, tiempo personal, reservas). También sirve para los Summits. |
| **Profundidad técnica y uso del API** | Usa las 12 operaciones (tabla abajo) y las dos interfaces (REST en la app, MCP a su lado). Maneja OAuth PKCE con refresh y revocación, paginación, cuotas por asistente, fallas parciales por sesión, el `409` antes de que se abra la escritura y el tiempo personal que solo acepta UTC. |
| **Calidad del proyecto en Builder Center** | Publicación con el problema, el método, el diagrama de arquitectura, un video demo y la agenda real del autor antes y después de re:Invent como caso de uso. |

## Cobertura del API

| Operación | Función en Re:Match | Estado |
|---|---|---|
| `ListEvents` | `rematch events`: elegir el evento | ✅ |
| `GetEvent` | Zona horaria y fechas del evento para la agenda | ⬜ |
| `ListSessions` | Descarga y caché del catálogo completo | ✅ |
| `GetSession` | Actualizar la disponibilidad de asientos de las sesiones preseleccionadas antes de reservar | ⬜ |
| `GetSchedule` | Importar favoritos y reservas existentes como señales y horarios fijos; verificar cada escritura | ⬜ |
| `AssociateFavorites` | ❤️ en el swipe → favorito | ⬜ |
| `DisassociateFavorite` | ❌ sobre una sesión que ya era favorita → se quita | ⬜ |
| `CreatePersonalTime` | Tiempo de traslado entre venues, Expo, comidas, Ask the Experts | ⬜ |
| `UpdatePersonalTime` | Mover esos bloques cuando cambia la agenda | ⬜ |
| `DeletePersonalTime` | Quitar bloques creados por Re:Match que ya no hacen falta | ⬜ |
| `ReserveSessions` | Reservar la agenda confirmada | ⬜ |
| `CancelReservation` | Cambiar a una sesión con mejor match, con confirmación | ⬜ |

Re:Match solo modifica los bloques de tiempo personal que él mismo creó (marcados en la descripción), nunca los del asistente.

## Calendario

| Fechas | Hito |
|---|---|
| 24 sep | ✅ Motor de match con catálogos públicos, documentación del concepto |
| 25 sep – 3 oct | `rematch login` (Builder ID), catálogo `reinvent2026`, importar `GetSchedule`, swipe en terminal sincronizado con favoritos |
| 4 – 8 oct | Armado de agenda (conflictos, traslados, costo de oportunidad), tiempo personal, reservas. **Usarlo para la agenda propia el 6–8 de octubre** |
| 9 – 20 oct | UI web de swipe local, learning paths, sugerencias de cambio (`CancelReservation` + `ReserveSessions`) |
| 21 – 30 oct | Servidor MCP, paquete `npx`, robustez (cuotas, fallas parciales, manejo de tokens) |
| 31 oct – 4 nov | Publicación en Builder Center, video demo, capturas, pulir README |
| **5 nov** | Entregar (un día de margen antes de la fecha límite) |

## Checklist de entrega

- [ ] Repositorio público (GitHub) con código funcionando
- [ ] README: instalación, dependencias, cómo correrlo (inglés + español)
- [ ] Proyecto en Builder Center: qué es, por qué, cómo usa el API y el servidor MCP
- [ ] Diagrama de arquitectura
- [ ] Video demo (≤ 3 min): perfil → swipe → agenda → portal oficial
- [ ] Sin datos del catálogo de re:Invent en el repo (no es público; los tests usan solo catálogos públicos de Summits)
- [ ] Aviso de proyecto no oficial; revisar el nombre por temas de marca
