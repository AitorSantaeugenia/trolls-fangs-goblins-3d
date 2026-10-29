# Registro de cambios

## v1.11.2 — 29-10-2026 (listo para subir a GitHub)

- `node server.mjs` lee ahora un archivo **`.env`** en la carpeta del proyecto (`MONGODB_URI`, `MONGODB_DB`, `PORT`…); hay un `.env.example` de muestra. Lo que se ponga en PowerShell sigue mandando.
- Las páginas de las herramientas (retratos 3D, iconos de artilugios, pruebas de héroes) pasan de `www/` a **`tools/dev/`**: ya no se publican con el juego. El servidor local las sirve en `/dev/` (solo en tu ordenador).
- `.gitignore` deja fuera, además, los archivos que el juego ya no usa (panel web antiguo, imágenes viejas, páginas `dev-` de `www/`) por si siguen en la carpeta.

## v1.11.1 — 28-10-2026 (nuevo logo y nuevas portadas)

- **Nuevo logo** «Trolls, Fangs & Goblins 3D» en la pantalla de carga y en el menú principal, en lugar del título de texto y el «TD 3D».
- **Nuevas portadas de victoria y derrota**: recortadas al dibujo, sin el velo casi transparente del fondo y en WebP (unos 80 KB cada una en vez de 750 KB). Se ven al mismo tamaño las dos.
- **App de administración**: el icono del `.exe` y de la ventana es ahora el nuevo logo.

## v1.11.0 — 28-10-2026 (estrellas claras, avisos de trucos y nuevo ataúd)

- **Estrellas explicadas**: debajo de los mapas hay una leyenda (★ ganar · ★★ con la mitad de las vidas · ★★★ con el 90 %; ∞ es tu oleada récord del infinito) y cada tarjeta lo dice al pasar el ratón. En la pantalla de victoria se indica qué falta para la siguiente estrella.
- **Con trucos no se ganan estrellas** (como ya pasaba con los logros y la clasificación).
- **Modo infinito y trucos**: al elegir el infinito en un mapa oficial, un aviso explica que con trucos (o recuperando la partida) no se entra en la clasificación. La caja de trucos lo recuerda y, al usar el primero, sale «esta partida ya no entra en la clasificación».
- **Nuevo ataúd en la derrota**: el GIF anterior (un meme con derechos) se sustituye por una animación propia en 3D: seis enemigos del juego elegidos al azar cargan con un ataúd a ritmo de marcha, con aspecto de píxel.

## v1.10.0 — 28-10-2026 (administración en el escritorio y límites diarios)

- **Nueva app de administración de escritorio** (`admin-app/`, Electron, fuera de Git): se abre con `npm run dev` o como `.exe` portátil de Windows (`npm run build`). Se conecta directamente a MongoDB Atlas o al `data/scores.json` local y muestra:
  - **Resumen**: visitas de hoy, 7 y 30 días y totales (con personas distintas), gráfica de 30 días, récord de cada mapa, mapas más jugados y actividad reciente.
  - **Jugadores** (agrupados por la huella anónima de su IP): nombres usados, puntuaciones, mapas y visitas; **renombrar en todo**, **borrar todo** lo publicado y **bloquear**.
  - **Clasificación** (editar, ocultar, borrar, también varias a la vez), **Mapas** (con vista previa; editar, ocultar, borrar, bloquear al autor), **Bloqueos** y **Copia de seguridad** en JSON.
  - La conexión se recuerda cifrada con el usuario de Windows, o se lee de `admin-app/.env`.
- **Retirado el panel web** (`admin.html`) y sus rutas de la API: ya no existe `ADMIN_PASSWORD` y la web no tiene nada de administración que atacar.
- **Límites por jugador**: como mucho **10 puntuaciones** y **2 mapas publicados cada 24 horas** (además del límite de 20 envíos cada 10 minutos). Un mapa no válido o repetido no gasta cupo.
- **Bloqueos**: un jugador bloqueado puede jugar, pero la API rechaza sus puntuaciones y mapas.
- **Visitas**: el juego avisa de cada visita (anónima, una por persona y día con su número de páginas vistas) para las estadísticas de la app.
- `.gitignore` deja fuera también `admin-app/`, los `.env` y las compilaciones.

## v1.9.0 — 28-10-2026 (mapas de la comunidad)

- **Mapas de la comunidad** (en «Elige el campo de batalla», debajo de «Mis mapas»): lista de los mapas que ha publicado la gente, con **miniatura**, nombre, nick del autor, fecha, bioma, vidas, oro, dificultad de las oleadas y partidas jugadas. Ordenable por **Nuevos** o **Más jugados** y con buscador.
  - Al pulsar uno se abre su **ficha**: vista previa grande del mapa, autor, **descripción**, datos y botones **▶ Jugar**, **∞ Infinito**, **Guardar en Mis mapas** y **Copiar código**.
  - Las partidas se cuentan (como mucho una cada 10 minutos por jugador y mapa).
- **Publicar un mapa**: botón **🌍 Publicar** en cada mapa de «Mis mapas», o **Publicar un código** pegando un `TFG1:…`. Se pone nombre, nick y una descripción de hasta 400 caracteres, con vista previa. El servidor comprueba que el código sea un mapa válido y no deja publicar dos veces el mismo mapa.
- **Panel de administración**: nueva sección **Mapas de la comunidad** con la vista previa de cada mapa: cambiar nombre, nick, descripción y partidas, **ocultar** de la lista pública, **borrar** o copiar su código. «Descargar JSON» y «Subir JSON» incluyen también los mapas.
- Los mapas se guardan junto a la clasificación: en **MongoDB Atlas** (colección `maps`) en la web publicada y en `data/scores.json` en local.
- Los mapas de la comunidad se juegan como los propios, pero no entran en la clasificación del modo infinito (solo los cinco mapas oficiales).

## v1.8.1 — 27-10-2026 (listo para GitHub Pages + MongoDB Atlas)

- **Publicación prevista**: el juego en **GitHub Pages**, la API de la clasificación en una función de **Vercel** y los datos en **MongoDB Atlas** (todo en planes gratuitos). Guía paso a paso en `docs/DEPLOY.md`.
  - `docs/github-pages.yml` (va en `.github/workflows/pages.yml`) publica `www/` en GitHub Pages con cada `git push`.
  - `api/index.js` + `vercel.json`: la API en Vercel; las contraseñas (base de datos y admin) solo viven allí, nunca en el navegador.
  - `www/js/apiconfig.js`: dónde está la API cuando el juego se abre desde GitHub Pages (`REMOTE_API`). En tu ordenador sigue usando el servidor local.
  - La API acepta peticiones de la web de GitHub Pages (CORS, variable `ALLOWED_ORIGINS`).
- La API pasa a módulos compartidos (`lib/`): las mismas rutas, validaciones y límites sirven con el JSON local (`server.mjs`) y con MongoDB (Vercel, o `server.mjs` con `MONGODB_URI`). Comprobado que los dos almacenes dan exactamente los mismos resultados.
- La sesión del panel de administración es ahora un token firmado (vale igual en un servidor y en funciones sin estado como las de Vercel) y los límites de envíos por IP se guardan en la base de datos.
- Si la clasificación no está disponible (sin API configurada o sin conexión), el juego lo dice claramente en vez de mostrar un error.
- Arreglado: el botón ‹ de la pantalla Clasificación no volvía al menú.

## v1.8.0 — 27-10-2026 (modo infinito nuevo y clasificación online)

- **Modo infinito rehecho**: tras pulsar «Empezar», las oleadas salen **solas cada cierto tiempo, sin cuenta atrás a la vista** (40 s al principio, cada vez menos, hasta 20 s), haya o no enemigos en pie. Cada oleada es más grande, los enemigos salen más juntos, tienen más vida y, desde la 15, llegan jefes extra. No hay final: se juega hasta caer.
  - Cuando ya han salido todos los de la oleada, el botón **⏩ Adelantar oleada** trae la siguiente antes (da algo de oro).
  - En la pausa, **Rendirse y guardar puntuación** acaba la partida.
  - Una partida infinita ya no se guarda a medias para «Continuar» (no hay pausas entre oleadas y así la clasificación es justa).
  - El récord personal pasa a ser la **oleada alcanzada**.
- **Clasificación online** (pantalla nueva en el menú): por mapa, quién ha llegado más lejos (oleada; a igualdad, más bajas y menos tiempo), con nombre, bajas, héroe o sin héroe, torres construidas, oro, daño y tiempo. Al caer en infinito, el final de partida pide tu nombre (se recuerda) y te dice en qué puesto has quedado.
  - No puntúan las partidas con trucos (salvo `ororo`), las recuperadas ni los mapas personalizados.
- **Servidor** (`server.mjs`): guarda la clasificación en un JSON propio (`data/scores.json`, con escritura segura y copia `.bak`), valida las puntuaciones, limita envíos por IP y guarda solo una huella anónima de la IP.
- **Panel de administración** (`/admin.html`, con la contraseña de `ADMIN_PASSWORD`): ver, editar, ocultar, borrar y añadir puntuaciones; descargar y subir el JSON.
- Nuevas estadísticas de partida: **daño realizado** y **tiempo** (también en el final de partida normal).
- Guía para publicarlo: `docs/DEPLOY.md`.

## v1.7.2 — 27-10-2026

- **Instrucciones › Enemigos**: bestiario con el **modelo 3D** de cada enemigo (antes, el sprite plano), ordenado de esbirro a jefes, con etiquetas *Jefe* y *Vuela* y fichas de vida, oro, velocidad y golpe a los héroes.
- **Instrucciones › Héroes**: una **ficha por héroe** con su modelo 3D, tipo, descripción, estadísticas (vida, armadura, daño, ataques por segundo, alcance y esbirros extra) y sus **habilidades bien ordenadas**: Q, W, la definitiva E y la pasiva, cada una con su icono, recarga y descripción. Debajo, las reglas comunes (moverlo, AUTO, energía, caídas).
- **Elector de héroe**: el retrato de cada héroe es ahora su modelo 3D (busto) en vez de un emoji.
- Las imágenes salen de los propios modelos del juego (`tools/portraits.cjs`), así que siempre coinciden con lo que se ve en partida.

## v1.7.1 — 22-10-2026

- **Arreglado: héroes «andando en el sitio»**. Al llegar a un punto se quedaban a una milésima del destino, seguían animados andando y la orden de moverse no se borraba nunca, así que dejaban de hacer caso al modo AUTO (pasaba sobre todo tras moverlos a mano y volver a poner AUTO). Ahora en AUTO van siempre a buscar enemigos aunque estén fuera de su alcance (comprobado en simulación con los tres héroes y en todos los niveles).
- **Retirada más corta y visible**: con menos del 20 % de vida el héroe dice «¡Retirada!», vuelve a su punto de guardia, se cura deprisa allí y en unos segundos vuelve a la carga (antes se quedaba quieto 15–20 s).
- **Tuerca**:
  - al apuntar la **minitorreta** o el **cepo** se ve cómo quedará: en **verde** si se puede poner y en **rojo** si no;
  - la **minitorreta en el camino** frena hasta 3 enemigos, pero le pegan: tiene barra de vida (220, crece con las oleadas) y se rompe enseguida («¡Destrozada!»). Al apuntarla sobre el camino el círculo se marca en naranja y avisa al colocarla. Fuera del camino sigue siendo intocable;
  - **imágenes propias** del cepo y la minitorreta en el panel del héroe, el elector y las instrucciones (dibujadas a partir de sus modelos 3D);
  - cepo y minitorreta más grandes en el mapa.
- Arreglado: si se llamaba la oleada sin colocar al héroe, se colocaba solo pero el juego seguía «esperando su sitio» y la tecla Esc no cancelaba lo que estabas apuntando.

## v1.7.0 — 22-10-2026 (Tuerca y héroes por todo el mapa)

- **Nuevo héroe: Tuerca, la artillera goblin** (a distancia, control):
  - metralleta de **10 disparos por segundo** pero de muy poco daño; tras **25 disparos se recalienta** y a veces **se encasquilla**: 3 s sin disparar (los cañones se ponen al rojo y echan humo, y el panel muestra el calor);
  - **Q — Cepo explosivo**: se pone con el ratón en el camino; al pisarlo estalla, daña y deja clavados a los enemigos de alrededor 2,5 s (los jefes, la mitad). Hasta 3 a la vez;
  - **W — Minitorreta**: se planta con el ratón y dispara sola durante 20 s, a tierra y aire;
  - **E — Lluvia de cohetes** (definitiva): 10 cohetes contra los enemigos más peligrosos de todo el mapa, primero los jefes;
  - modelo 3D propio: gorro de aviador, gafas de soldar ámbar, bombona de cobre y metralleta de cañones giratorios; sonidos propios (ráfaga, cohetes, ¡clac! del cepo).
- **Los héroes se mueven por todo el mapa**: desaparece la zona. En **AUTO** van siempre a por algún enemigo, esté donde esté, y si no queda ninguno vuelven a su **punto de guardia** (donde los colocaste o los mandaste por última vez).
- **Retirada automática**: en AUTO, con menos del 25 % de vida el héroe vuelve a su punto de guardia hasta recuperar el 70 %.
- El Salto del cazador y la Nova arcana ya no dependen de la zona: alcanzan a los enemigos que el héroe tiene alrededor.
- **Equilibrio** comprobado con el bot: los tres héroes ganan los 5 niveles (caídas por partida: Chamán 0–2, Colmillo 0–3, Tuerca 0–1).
- El elector de héroe muestra las 5 opciones en una fila.
- Instrucciones (pestaña Héroes) actualizadas.
- Proyecto: quitadas de `package.json` las dependencias de Capacitor (el APK está aparcado); `npm audit` queda sin avisos.

## v1.6.0 — 20-10-2026 (panel del héroe)

- **Panel del héroe estilo Warcraft III** (sin adornos), abajo a la izquierda; la barra de torres pasa a la derecha:
  - **retrato 3D en vivo** (cabeza y hombros, con luz de contorno del color del héroe): respira, mira a los lados, golpea cuando ataca, se sacude si recibe daño y se queda gris si cae (con la cuenta atrás);
  - **vida** (verde) y **energía** (azul) en porcentaje;
  - nombre, «Nivel 1 · clase» y **estadísticas con icono**: Daño, Armadura, Alcance / zona y Ataques por segundo (el daño crece con las oleadas);
  - **tarjetas de habilidad** Q, W y **E** con descripción al pasar el ratón, la **pasiva** y el botón **AUTO**.
- **Definitivas (E)**: la energía se carga con las bajas (más si las hace el héroe). **Nova arcana** (Chamán): daña y aturde a todo lo que hay en su zona. **Frenesí** (Colmillo): 8 s atacando un 70 % más rápido y curándose con cada zarpazo. Se lanzan unas 2 veces por nivel; el equilibrio con el bot no cambia.
- **Pasivas** descritas en el panel: Orbes inestables (Chamán) y Piel de lobo (Colmillo).
- **Efectos inspirados en *Arcane***: luz «hextech» que recorre el marco del panel (más rápida con la definitiva lista), runas girando alrededor de las habilidades que recargan, destello al quedar listas, salpicaduras de pintura neón al lanzarlas, garabatos neón alrededor del retrato y, en la definitiva, instante congelado, zoom de cámara, separación de colores y velo de color.
- Tecla **E** para la definitiva. En móvil, el panel se compacta (retrato pequeño, sin estadísticas).

## v1.5.2 — 20-10-2026

- **Truco `ororo`** (para probar el clima): lanza ya un fenómeno meteorológico al azar del bioma, con su aviso y sus efectos. Si ya hay uno en curso no lo cambia (avisa de que hay que esperar a que acabe).

## v1.5.1 — 15-10-2026

- **Mismo modelo para todos los héroes**: se mandan a cualquier punto del mapa y ese punto es el centro de su **zona** de acción (anillo discontinuo).
- **Modo AUTO** (botón a la derecha del retrato o tecla **A**, activado por defecto): dentro de su zona va a por los enemigos; sin AUTO se queda quieto donde lo mandes.
- **Equilibrio**: Chamán con más alcance y menos daño (seguro fuera del camino); Colmillo con más daño, **barrido** del 50 % a los que tiene alrededor y **armadura** del 30 %, pero pelea en el camino. Esbirros extra según el héroe (×2 Chamán, ×1,5 Colmillo) y oro total parecido al clásico. Comprobado con el bot en los 5 niveles.
- El sitio automático del héroe prefiere el centro del mapa en caso de empate.

## v1.5.0 — 15-10-2026 (héroes, paso 1)

- **Héroes**: tras elegir mapa se elige héroe (o **Sin héroe**, el modo clásico original).
  - **Chamán troll** (a distancia): orbes arcanos que dañan en área; camina por casi todo el mapa; habilidades lluvia de meteoritos y ventisca.
  - **Colmillo, el cazador** (cuerpo a cuerpo): corre hacia los enemigos que entran en su zona de guardia y **frena hasta 2 a la vez**; habilidades **Salto del cazador** (Q) y **Aullido** (W, aturde).
  - Reina goblin: anunciada como «próximamente».
- **Colocación** como una torre al empezar (gratis; recolocable gratis hasta la 1.ª oleada; si no se coloca, se pone solo en el mejor sitio). **Moverlo**: clic en él, en su retrato o tecla **H**, y clic derecho (o clic) en el mapa.
- **Los enemigos de tierra le pegan**; si cae, reaparece en su sitio a los pocos segundos. Se cura poco a poco fuera de combate.
- Con héroe salen **el doble de esbirros** (dan el 55 % de oro). Equilibrado con el bot (`node tools/balance.mjs --hero=shaman|fang`): resultados parecidos al modo clásico.
- Modelos 3D animados (andar, atacar, morir), brillo de color bajo sus pies, anillos de alcance y de movimiento, barra de vida, efectos de salto, aullido, muerte y reaparición.
- **Tarjeta del héroe** en el HUD (vida, estado y tiempo para reaparecer) y botones de habilidad según el héroe.
- La partida guardada recuerda el héroe y su posición. Nueva pestaña **Héroes** en Instrucciones.


## v1.4.0 — 15-10-2026

- **Nuevo fondo de puerta** (con el dragón y gemas azules) en la carga y todos los menús.
- **Música igualada**: todas las pistas suenan a ≈ −18 LUFS (antes *Power of the Horde*, en Desierto e Infierno, iba unos 6 dB más fuerte). La Marcha del Goblin queda 1,5 dB por debajo porque apenas tiene dinámica.
- **Pantalla de victoria o derrota**: al aparecer se corta en seco todo lo que sonaba (música del nivel, efectos, clima y truenos) y solo suena la música de victoria o derrota.
- **Menús en silencio**: ni la selección de mapa ni el resto de menús reproducen música; cada nivel arranca la suya al empezar la partida.
- **Tema libre «Marcha del Goblin»**: música original compuesta por código (`tools/compose_theme.py`), de uso libre.
- **Música en el editor de mapas**: cada mapa propio elige su música. Por defecto el tema libre; también las pistas del juego, sin música o **un audio propio del ordenador** (se guarda en el navegador, se ajusta su volumen al de la música del juego y no viaja en el código para compartir). Los códigos `TFG1:` incluyen ahora la música elegida (salvo el audio propio).
- **Instrucciones → pestaña «Clima»**: cada fenómeno, en qué bioma aparece, su efecto en la partida y cómo desactivarlo. Disponible desde el menú y desde Pausa → Instrucciones.

## v1.3.1 — 15-10-2026

- **Truco `thanos` con sonido nuevo**: «I am inevitable» al aparecer el guantelete (más bajo, con el juego algo atenuado mientras suena), sonido de chasquido (`thanosSnap.mp3`) sincronizado con el destello y, al morir los enemigos, el efecto de muerte (`thanosDeath.mp3`), al mismo nivel que «I am inevitable».
- Mientras suena el efecto de muerte: música y efectos del juego al mínimo y **pantalla oscura**, con el **humo marrón de los enemigos y el guantelete por encima** de la oscuridad.
- **Volumen general del juego −3 dB** (música, efectos, clima y Thanos por igual, misma proporción entre ellos).
- Al terminar: **1 segundo de cámara lenta** (el juego arranca al 15 % de velocidad y vuelve a la normal) mientras se disipa la oscuridad y vuelve el audio.

## v1.3.0 — 15-10-2026

- **Sonido en las torres**, generado dentro del juego: cada torre tiene su disparo (arena: chasquido; catapulta: madera y piedra; hielo: cristal; doble cañón: ráfaga; pesado: estampido; veneno: burbujeo; fuego: llamarada) e impactos para catapulta, cañón pesado y meteoritos. Límite de 12 voces y separación mínima por tipo para no saturar.
- **Todos los efectos por debajo de la música**, medidos en LUFS (`tools/audiolevels.cjs`): torres y lluvia ≈ −37, truenos y meteoritos ≈ −32, viento ≈ −40, frente a la música entre −27 y −21. Excepción: el chasquido de Thanos, que suena por encima.
- **Silencio en los menús**: al salir de la partida se corta al instante cualquier efecto, clima o trueno pendiente.

## v1.2.0 — 15-10-2026

- **El clima afecta a la partida**: ventisca (enemigos −10 % de velocidad), tormenta de arena (torres −10 % de alcance), lluvia (fuego −20 %), tormenta (fuego −20 % y rayos que golpean a los enemigos), niebla (hielo +25 % de duración) y lluvia de fuego (quema a todos los enemigos). Se puede dejar solo visual en Ajustes.
- Aviso del clima grande en el centro, con el efecto debajo.
- Ruido de ventisca y lluvia mucho más bajo y sin bucle audible.
- El editor de mapas va en silencio.
- Versión para el navegador del ordenador: el servidor (`node server.mjs`) solo escucha en `localhost`; el acceso desde el móvil por WiFi queda desactivado. La interfaz sigue adaptándose a pantallas de móvil.

## v1.1.0 — 14-10-2026 (versión navegador)

Prioridad al navegador de ordenador; la interfaz sigue funcionando en móvil.

- **Calidad Ultra** (nueva opción por defecto en ordenador): resolución nativa, sombras 4096, MSAA ×8, brillo a resolución completa y más partículas.
- **Clima dinámico** por bioma, solo visual y sonoro: lluvia y tormentas con rayos y truenos (Pradera), niebla baja y tormenta (Cementerio), ventisca (Glaciar), tormenta de arena (Desierto) y ceniza o lluvia de fuego (Infierno). Se puede apagar en Ajustes.
- **Guardado de partida**: se guarda al superar cada oleada y al salir. Botón **Continuar** en el menú principal.
- **25 logros** con aviso emergente y pantalla propia (con barras de progreso). Las partidas con trucos no cuentan, salvo un logro secreto.
- Menú principal en dos columnas en pantallas bajas (móvil en horizontal).

## v1.0.0 — 14-10-2026 (snapshot antes de la APK)

Primera versión completa del remake 3D en three.js.

**Base (recreación del original)**
- 4 niveles originales con sus caminos, vidas, oro y oleadas exactos (extraídas del `wave.js` original).
- Mundo 3D low-poly por bioma (pradera, cementerio, glaciar, infierno) con luces, sombras, niebla, decorados, castillo/portal, cueva y hoguera.
- Música, sonidos, trucos (`greedisgood`, `hollymolly`, `whosyourdaddy`, `ezwin`, `4lose`, `thanos`).
- Controles de ratón y táctiles, cámara orbitable, velocidad x1/x2/x3, pausa, estrellas guardadas.

**Fase 1 — Pulido**
- Guantelete 3D para el truco `thanos`, prioridad de objetivo por torre, brillo (bloom), tutorial interactivo.

**Fase 2 — Contenido**
- Torres nuevas: Doble Cañón, Cañón Pesado, Torre de Veneno. Mejoras hasta nivel 3 y venta al 70 %.
- Resistencias (voladores, fuego del Infierno, Señor de las Nieves) y modo infinito con récord.

**Fase 3 — Jefes en 3D**
- Los 8 jefes como modelos 3D animados; muertes distintas según el tipo de enemigo.

**Fase 4 — Expansión**
- Habilidades activas: lluvia de meteoritos (Q) y ventisca (W).
- Nivel nuevo: Dunas del Escorpión (desierto, dificultad Medio).
- Editor de mapas con códigos `TFG1:` para compartir.

**Fase 5 — Esbirros en 3D**
- Los 30 aspectos de esbirros en 9 arquetipos 3D instanciados.

**Pendiente**
- Rendimiento en móvil (probado en un Xiaomi por WiFi: va algo cargado).
- Generar y probar la APK en un móvil real.
- Ranking online (decidir dónde alojarlo).
