# Plan del hackatón

🇬🇧 [English version](HACKATHON.md)

Reinvent:Match se construye para el hackatón del AWS Events API. Fecha límite de entrega: **6 de noviembre de 2026, 11:59 PM PT**.

## Criterios de evaluación → qué aporta Reinvent:Match

Cuatro criterios con el mismo peso (25% cada uno):

| Criterio | Cómo lo cubre Reinvent:Match |
|---|---|
| **Creatividad y novedad de la integración** | Match persona ↔ sesión en lugar de un buscador. Categorías explicadas (Deep Dive, Growth, Foundation, Discovery, Skip), *irreemplazabilidad* de los formatos presenciales, learning paths a lo largo de la semana y costo de oportunidad de cada elección. Un servidor MCP local que **se combina con** el MCP oficial `awsevents`: el asistente usa el nuestro para decidir y el oficial para actuar. |
| **Utilidad para asistentes de re:Invent** | Pensado para el 47% que va por primera vez: convierte 2,000+ sesiones en ~15 con razones, evita sesiones demasiado básicas o avanzadas y lleva la agenda al portal oficial (favoritos, tiempo personal, reservas). También sirve para los Summits. |
| **Profundidad técnica y uso del API** | Usa las 12 operaciones (tabla abajo) y las dos interfaces (REST en la app, MCP a su lado). Maneja OAuth PKCE con refresh y revocación, paginación, cuotas por asistente, fallas parciales por sesión, el `409` antes de que se abra la escritura y el tiempo personal que solo acepta UTC. |
| **Calidad del proyecto en Builder Center** | Publicación con el problema, el método, el diagrama de arquitectura, un video demo y la agenda real del autor antes y después de re:Invent como caso de uso. |

## Cobertura del API

| Operación | Función en Reinvent:Match | Estado |
|---|---|---|
| `ListEvents` | `reinvent-match events`: elegir el evento | ✅ |
| `GetEvent` | Zona horaria y fechas del evento para la agenda | ⬜ |
| `ListSessions` | Descarga y caché del catálogo completo | ✅ |
| `GetSession` | Actualizar la disponibilidad de asientos de las sesiones preseleccionadas antes de reservar | ⬜ |
| `GetSchedule` | `reinvent-match schedule`; My Match muestra los favoritos actuales; cada sincronización lo vuelve a leer; falta importarlo a la agenda | ✅ |
| `AssociateFavorites` | ❤️ en el swipe → favorito (lotes de 10; `alreadyFavorited` cuenta como hecho) | ✅ |
| `DisassociateFavorite` | ❌ sobre una sesión que ya era favorita → se quita | ✅ |
| `CreatePersonalTime` | Tiempo de traslado entre venues, Expo, comidas, Ask the Experts | ⬜ |
| `UpdatePersonalTime` | Mover esos bloques cuando cambia la agenda | ⬜ |
| `DeletePersonalTime` | Quitar bloques creados por Reinvent:Match que ya no hacen falta | ⬜ |
| `ReserveSessions` | My Match → Reservations: reserva las ❤️ en orden de prioridad, de diez en diez, y un respaldo cuando una está llena (activo desde el 8 de octubre) | ✅ |
| `CancelReservation` | Cancelar una reserva desde la vista Reservations, con confirmación en la página | ✅ |

Reinvent:Match solo modifica los bloques de tiempo personal que él mismo creó (marcados en la descripción), nunca los del asistente.

## Calendario

Meta: **la herramienta está completa antes de que abra la reserva de asientos el 6 de octubre**, para que el autor la use para su propia agenda desde el primer día.

La reserva abre el **6 de octubre** en el portal, pero la escritura por API (reservar y cancelar) abre hasta el **8 de octubre**. El plan para el día de apertura toma en cuenta esa diferencia:

- **Para el 5 de octubre:** los favoritos ya están sincronizados con el portal oficial, y Reinvent:Match genera un *plan de reserva*: la agenda sin choques, ordenada por valor × escasez y con un respaldo para cada horario. El 6 de octubre el asistente reserva en el portal siguiendo ese orden, empezando por las sesiones que más probablemente se llenen.
- **Desde el 8 de octubre:** `reinvent-match reserve` reserva por API lo que falte; si una sesión está llena (`sessionFull`), usa el respaldo que el asistente aprobó antes; reporta choques de horario (`scheduleConflict` + `conflictsWith`); y un vigilante revisa la disponibilidad de asientos de las sesiones llenas sin pasarse de las cuotas.

| Fechas | Hito |
|---|---|
| 24 sep | ✅ Motor de match con catálogos públicos, documentación, inicio de sesión con Builder ID |
| 25 – 27 sep | Catálogo `reinvent2026` con el perfil del autor; calibrar reglas y pesos con datos reales |
| 28 sep – 1 oct | Swipe (terminal) con ❤️/❌ sincronizado con favoritos; importar `GetSchedule` |
| 2 – 4 oct | Armado de agenda (choques, traslados entre venues, costo de oportunidad, respaldos), tiempo personal, plan de reserva |
| **5 oct** | Herramienta completa para el día de apertura; prueba completa de punta a punta |
| 6 oct | Reservar en el portal siguiendo el plan |
| 8 oct | `reinvent-match reserve` en vivo contra el API (primera prueba real de escritura) |
| 9 – 20 oct | Vigilante de asientos, sugerencias de cambio, UI de swipe local, servidor MCP |
| 21 – 31 oct | Publicación en Builder Center, video demo con resultados reales del 6–8 de octubre |
| Antes del 6 nov | Entregar |

## Checklist de entrega

- [ ] Repositorio público (GitHub) con código funcionando
- [ ] README: instalación, dependencias, cómo correrlo (inglés + español)
- [ ] Proyecto en Builder Center: qué es, por qué, cómo usa el API y el servidor MCP
- [ ] Diagrama de arquitectura
- [ ] Video demo (≤ 3 min): perfil → swipe → agenda → portal oficial
- [ ] Sin datos del catálogo de re:Invent en el repo (no es público; los tests usan solo catálogos públicos de Summits)
- [ ] Aviso de proyecto no oficial; revisar el nombre por temas de marca
