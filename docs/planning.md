# Trolls, Fangs & Goblins 3D — Planning

Documento vivo (editable): https://claude.ai/code/artifact/1980dc4f-3db6-4437-b0d4-431ef5cd5ec0
Última actualización: 2026-10-14

## Estado actual

Remake en `Desktop/Personal/Dev/claude/trolls_fangs_globlins_three.js` (antes en el Escritorio), three.js r170 sin bundler. Proyecto original intacto.

| Área | Estado |
| --- | --- |
| Niveles | 5: los 4 originales (caminos y oleadas idénticos) + Dunas del Escorpión (Medio, desierto) |
| Torres | 7 (Arena, Catapulta, Hielo, Doble Cañón, Cañón Pesado, Veneno, Fuego), mejorables a nivel 3, venta al 70 %, prioridad de objetivo |
| Resistencias | Voladores ×0.7 contra piedras/obuses; esbirros del Infierno ×0.6 al fuego; Señor de las Nieves casi inmune al hielo y ×1.5 al fuego |
| Modo infinito | En los 4 mapas, récord por mapa |
| Enemigos | Todo en 3D: 8 jefes (`js/bosses.js`) y 30 esbirros en 9 arquetipos instanciados (`js/minions3d.js`); muertes según tipo; ambos desactivables en Ajustes (vuelven a sprites) |
| Efectos | Partículas, ondas, textos flotantes, hoguera, ambiente por bioma, bloom |
| Trucos | Los 6 originales; `thanos` con guantelete 3D |
| Tutorial | Interactivo en Fácil la primera vez |
| Equilibrio | Vida extra creciente en Normal, Difícil e Infierno, probado con un bot (`tools/balance.mjs`) |
| App móvil | Capacitor configurado, sin APK generado (aparcado). Prueba por WiFi bloqueada en el PC del usuario ("unreachable"): pendiente firewall/IP o prueba por USB |

## Decisión 1: guantelete en 3D — DECIDIDO: B (implementado)

Guantelete low-poly procedural con 6 gemas que baja, chasquea, destello + onda, enemigos a polvo.
El guantelete y "Thanos" son de Marvel: si se publica en tiendas, rediseñar y renombrar.

## Decisión 2: enemigos en 3D — DECIDIDO: B (híbrido, implementado)

8 jefes en 3D low-poly con animación procedural; esbirros con los sprites originales.

| Opción | Qué cambia | Esfuerzo |
| --- | --- | --- |
| A. Sprites mejorados | Contorno, sombra, luz del bioma | Bajo |
| B. Híbrido | Jefes 3D con animación procedural | Medio |
| C. Todo procedural | ~10 arquetipos low-poly | Medio-alto |
| D. GLB con esqueleto | Personajes animados reales | Alto |

Con C o D: `InstancedMesh` por arquetipo para el rendimiento en móvil.

## Mejoras propuestas

- Jugabilidad: héroe controlable. (Hecho: prioridad de objetivo, modo infinito, resistencias, habilidades activas)
- Contenido: más biomas. (Hecho: Cañón Pesado, Doble Cañón, torre de veneno, bioma desierto, editor de mapas)
- Visual: clima y día/noche, muertes por tipo. (Hecho: bloom)
- Meta: logros, guardado a mitad de partida, ranking online. (Hecho: tutorial)

## Hoja de ruta

1. ✅ Pulido (completada 2026-10-14): guantelete 3D, prioridad de objetivo, bloom, tutorial.
2. ✅ Contenido (completada 2026-10-14): Cañón Pesado, Doble Cañón, veneno, modo infinito, resistencias. Equilibrio validado con el bot (varias estrategias viables).
3. ✅ Enemigos 3D (completada 2026-10-14): los 8 jefes, muertes por tipo. Pendiente de verificar: 60 fps con ~30 enemigos en móvil medio.
4. 🔶 Expansión (en curso): ✅ habilidades activas (meteoritos Q, ventisca W), ✅ nivel Dunas del Escorpión (desierto, dificultad Medio). ✅ editor de mapas (cuadrícula, bioma, vidas, oro, oleadas; códigos TFG1 para compartir). Pendiente: ranking online (necesita decidir servidor).

5. ✅ Esbirros en 3D (añadida y completada 2026-10-14): los 30 aspectos de esbirros en ~8 arquetipos low-poly (ojo-murciélago, calavera de fuego, esqueleto, encapuchado, demonio, fantasma, ogro, gárgola) con variaciones de color. Requisito: `InstancedMesh` por arquetipo (rendimiento móvil) y opción de volver a sprites.

La app móvil se retoma tras la condición de la fase 3.

## Snapshot v1.0.0 (2026-10-14)

ZIP completo en `Desktop/trolls_fangs_globlins_three_snapshots/trolls_fangs_globlins_three_v1.0.0_2026-10-14.zip` + `CHANGELOG.md`. Prueba en Xiaomi por WiFi: algo cargado. Plan: rendimiento móvil → APK → prueba en móvil real.

## v1.1.0 — versión navegador (2026-10-14)

Decisión: priorizar el navegador de ordenador sin recortar por el peso en móvil; la interfaz táctil se mantiene.
- Calidad **Ultra** (por defecto en ordenador).
- **Clima dinámico** por bioma: lluvia, tormentas, niebla, ventisca, arena, ceniza, lluvia de fuego, con truenos y lluvia sintetizados.
- **Guardado de partida** entre oleadas y botón **Continuar**.
- **25 logros**.
- Pendiente: ranking online (falta elegir hosting), héroe controlable, más biomas.

**Clima con efecto en la partida (15-10-2026):** ventisca −10 % velocidad enemiga; arena −10 % alcance; lluvia −20 % fuego; tormenta −20 % fuego + rayos que golpean enemigos; niebla +25 % congelación; lluvia de fuego quema a todos. Aviso grande centrado. Ajuste «El clima afecta a la partida». Ventisca mucho más baja de volumen.

## Fase 6 (propuesta): mapas de la comunidad, oleadas a medida y personajes

**Mapas personalizados de la comunidad**
- Los jugadores crean mapas con el editor y los publican; sección «Mapas personalizados» con los mapas de todos (vista previa, autor, bioma, dificultad estimada, valoración).
- Filtros: nuevos, más jugados, mejor valorados, bioma, dificultad. Récord y ranking por mapa; reportar.
- Necesita servidor (misma decisión de hosting que el ranking). Hoy: códigos `TFG1:`.

**Editor de oleadas (junto al camino y el bioma)**
- Número de oleadas; enemigos por oleada (tipo, cantidad, orden, intervalo); jefes; multiplicador de vida; oro inicial y por enemigo.
- Plantillas (copiar oleadas de un nivel) y botón «Generar» por dificultad.
- El bot de equilibrio estima la dificultad antes de publicar.
- Ambiente por mapa: clima y densidad de decorados. Sin opción de audio: el editor va en silencio. Código `TFG2:` (los `TFG1:` siguen valiendo).

**Mapa de campaña + personaje**
- Mapa del mundo con niveles conectados que se desbloquean en orden.
- Personaje elegido antes de cada nivel con sus propias habilidades: Chamán troll (meteoritos + ventisca), Reina goblin (oro extra + refuerzos), Colmillo el cazador (héroe controlable cuerpo a cuerpo).
- Experiencia por partida y pequeño árbol de mejoras; personajes desbloqueables con estrellas o logros.

**Enemigos nuevos (para más adelante)**
- Esbirro de apoyo con aura que mejora a los enemigos cercanos: velocidad, vida o curación, defensa o escudo. Anillo de color visible en los afectados.
- Variantes: Chamán (cura), Tambor de guerra (velocidad), Portaestandarte (defensa). Modo de torre «apoyo primero». Disponible en el editor de oleadas.

**Añadidos propuestos**: desafío diario, modificadores de partida que multiplican la puntuación, estadísticas al final.

**Orden propuesto**: 1) editor de oleadas, 2) campaña + personajes, 3) mapas de la comunidad y desafío diario online (cuando se decida el hosting).

## Héroes y panel de habilidades (diseño, 15-10-2026)

El personaje de la Fase 6 pasa a ser un **héroe en el mapa**.

**Colocación**: antes de la primera oleada se coloca como una torre (fantasma + anillo de alcance en otro color, gratis). Se puede recolocar gratis en la preparación; ese punto es su **ancla**.

| | Cuerpo a cuerpo | A distancia |
|---|---|---|
| Anillos | Zona de guardia | Ataque (sólido) + movimiento (punteado, casi todo el mapa) |
| Ataque | Camina hasta el enemigo que entra en la zona, sin salir de ella; vuelve al ancla | Dispara como una torre desde donde esté |
| Moverlo | Se recoloca el ancla | Seleccionarlo y tocar el suelo, dentro de su zona de movimiento |
| Ventaja | Frena al enemigo con el que pelea | Llega a cualquier sitio |

Controles: clic en el héroe o su retrato (o tecla H) y clic en el suelo.

**Héroes iniciales**: Chamán troll (distancia; meteoritos y ventisca), Colmillo el cazador (cuerpo a cuerpo; salto y aullido que aturde), Reina goblin (distancia, apoyo; oro por baja y refuerzos que bloquean el camino). Cada uno: Q, W, definitiva E (se carga con bajas) y pasiva.

**Panel inferior (Warcraft III reinventado)**: retrato 3D en vivo a la izquierda (respira, parpadea, mira al objetivo, reacciona al daño y a las habilidades); nombre, nivel, vida y carga de la definitiva en el centro; tarjetas de habilidad con icono animado, recarga radial y descripción a la derecha. Sustituye a ☄ y ❄. En móvil, retrato reducido y panel plegable.

**Efectos estilo *Arcane* (sin copiar)**: sombreado por bandas con contorno de trazo; energía «hextech» azul-cian con runas que giran y luz que recorre el marco del panel; química verde/rosa neón con humo denso; estelas pintadas, salpicaduras de tinta, chispas 2D y aberración cromática breve en golpes fuertes; garabatos neón alrededor del retrato; definitiva con congelado, tinte y zoom (reutiliza la cámara lenta del guantelete).

**Orden**: 1) Chamán con colocación, anillos, movimiento y ataque; 2) panel con retrato 3D; 3) Colmillo con zona de guardia; 4) efectos *Arcane*; 5) Reina goblin, experiencia, mejoras y campaña.

**Decisiones (15-10-2026)**: los enemigos atacan al héroe y puede morir (reaparece en el ancla); con héroe salen el doble de esbirros. El cuerpo a cuerpo tiene cuerpo y bloquea (los enemigos se quedan peleando con él). Un héroe por partida, elegido al principio junto con el mapa.

**Estado**: ✅ paso 1 hecho en v1.5 (15-10-2026): elección de héroe (Chamán, Colmillo o sin héroe), colocación, anillos, movimiento, ataque, bloqueo, daño, muerte y reaparición, habilidades de Colmillo (salto y aullido), tarjeta del héroe en el HUD, guardado y equilibrio con el bot. Siguiente: paso 2, panel inferior con el retrato 3D en vivo.

## Héroes: modelo común, equilibrio, interfaz y próximo héroe (15-10-2026)

**Modelo común (v1.7, 22-10-2026; sustituye a la zona de la v1.5.1)**: los tres héroes se mueven por **todo el mapa**. El punto donde se colocan o se mandan es su **punto de guardia**. **AUTO** (botón a la derecha del retrato o tecla A): va **siempre a por algún enemigo**, esté donde esté (cuerpo a cuerpo, el más cercano; a distancia, el más avanzado que tenga a tiro o, si no, el más cercano); si no queda ninguno, vuelve al punto de guardia. **Malherido** (menos del 25 % de vida) se retira al punto de guardia hasta recuperar el 70 %, sin dejar de atacar lo que tenga a tiro. Sin AUTO se queda quieto y ataca lo que tiene a su alcance.

| | Chamán (distancia) | Colmillo (cuerpo a cuerpo) | Tuerca (distancia, control) |
|---|---|---|---|
| Daño | 22 cada 0,7 s, área pequeña | 50 cada 0,7 s + barrido 50 % | 7 × 10 por segundo; se recalienta a los 25 disparos y a veces se encasquilla (3 s) |
| Alcance | 11 | 2,4 | 9 |
| Vida / armadura | 480 / 5 % | 1500 / 30 % | 650 / 12 % |
| Riesgo | Fuera del camino, casi nunca le pegan | En el camino, frena a 2, le pegan todos; no alcanza voladores | Fuera del camino; depende de cepos y minitorreta |
| Esbirros extra | ×2 | ×1,5 | ×1,75 |

Bot (v1.7, con todo el mapa y la retirada): los tres ganan los 5 niveles. Caídas por partida: Chamán 0–2, Colmillo 0–3, Tuerca 0–1. Sin la retirada, Colmillo caía hasta 22 veces en Infierno. Oro total de esbirros parecido al clásico.

**✅ Interfaz estilo Warcraft III (hecha en v1.6, 20-10-2026, con definitivas E: Nova arcana y Frenesí, y pasivas)**, sin adornos de hojas: retrato 3D en vivo con vida (verde) y energía (azul) en %; centro con nombre, «Nivel 1 · clase» y estadísticas con icono (Daño, Armadura, Alcance, Velocidad); derecha con tarjetas de habilidad (Q, W, E, pasiva) y AUTO. Marco de madera oscura y metal dorado; efectos inspirados en *Arcane* (Netflix): luz hextech azul en los bordes, runas al cargar, salpicaduras pintadas y garabatos neón.

**✅ Tuerca, la artillera goblin (hecha en v1.7, 22-10-2026)**: metralleta de 10 disparos por segundo y 7 de daño que se **recalienta** tras 25 disparos y a veces se **encasquilla** (3 s sin disparar). **Q — Cepo explosivo**: se pone con el ratón en el camino; al pisarlo estalla, daña y deja clavados 2,5 s a los de alrededor (hasta 3 a la vez). **W — Minitorreta**: se planta con el ratón y dispara sola 20 s a tierra y aire. **E — Lluvia de cohetes**: 10 cohetes contra los enemigos más peligrosos del mapa (jefes primero). Pasiva: Gatillo fácil. Modelo: goblin con gorro de aviador, gafas de soldar, bombona de cobre a la espalda y metralleta de cañones giratorios.

**Ajustes v1.7.1 (22-10-2026, tras probarla el usuario)**: arreglado el héroe «andando en el sitio» que ignoraba el AUTO tras moverlo a mano; retirada corta (≤ 20 % de vida, se cura deprisa en su punto de guardia); vista previa verde/roja del cepo y la minitorreta; la minitorreta en el camino frena a 3 enemigos pero le pegan y se rompe (220 de vida); imágenes propias del cepo y la minitorreta en el panel.

**Siguiente héroe: Reina goblin** (a distancia, apoyo: más oro por bajas cercanas y refuerzos que cortan el camino).

## Modo infinito y clasificación online (v1.8, 27-10-2026)

- ✅ Oleadas automáticas cada 40 → 20 s sin cuenta atrás visible, sin final y cada vez más duras; botón para adelantar y opción de rendirse.
- ✅ Clasificación por mapa en un JSON propio del servidor (`data/scores.json`): nombre, oleada, bajas, héroe/sin héroe, torres, oro, daño y tiempo. Sin trucos, sin partidas recuperadas y solo mapas oficiales.
- ✅ ~~Panel de administración web (`/admin.html`)~~ → sustituido en v1.10 por la app de escritorio (ver abajo).
- **Alojamiento decidido (27-10-2026)**: el juego en **GitHub Pages**; la API en una función de **Vercel** y los datos en **MongoDB Atlas** (M0 gratis). Preparado en v1.8.1; falta que el usuario cree las cuentas y siga `docs/DEPLOY.md`.
- Antes de abrirlo al público: cambiar la música con derechos de los niveles por música libre.
- Idea: exportar e importar la partida guardada (al cambiar de dominio, el progreso local no se pasa solo).

## Mapas de la comunidad (v1.9, 28-10-2026)

- ✅ Publicar mapas del editor (desde «Mis mapas» o pegando su código) con nombre, nick y descripción.
- ✅ Lista con miniaturas, buscador y orden por nuevos o más jugados; ficha con vista previa grande, descripción y datos; jugar, infinito, guardar en Mis mapas y copiar código.
- ✅ Moderación desde la administración (editar, ocultar, borrar). Se publican al momento; si hiciera falta, se puede pasar a «pendiente de aprobar».
- ✅ Guardado en Atlas (colección `maps`) o en el JSON local.
- Ideas: valoraciones (me gusta), clasificación del infinito por mapa de la comunidad, mapa destacado de la semana.

## Administración de escritorio y límites (v1.10, 28-10-2026)

- ✅ **App de escritorio** `admin-app/` (Electron, fuera de Git; `npm run dev` o `.exe` portátil con `npm run build`). Se conecta directamente a Atlas o al JSON local. Páginas: Resumen (visitas y gráfica de 30 días, récords, mapas más jugados, actividad), Jugadores (por huella de IP: renombrar en todo, borrar todo, bloquear), Clasificación, Mapas, Bloqueos, Conexión y copia de seguridad.
- ✅ Retirado el panel web y `ADMIN_PASSWORD`: la web pública ya no tiene rutas de administración.
- ✅ Límites por jugador: **10 puntuaciones y 2 mapas cada 24 h** (`LIMITS` en `lib/scores-api.mjs`), más 20 envíos cada 10 min. Bloqueos (403 al guardar o publicar). Visitas anónimas por día.
- Pendiente del usuario: crear la base de datos en Atlas, `npm install` en `admin-app/` y probar la app en Windows (no se pudo ejecutar Electron en el entorno de pruebas; sí la ventana en Chromium y el acceso a datos).
- Ideas: gráfica de puntuaciones por día, aviso en la app cuando alguien llega al límite muchas veces, lista de palabras prohibidas para nombres.

## Pendientes e ideas para más adelante

**Héroes**
- **TODO: nivel de los héroes** (pedido el 27-10-2026). Ahora todos van siempre a «Nivel 1» (el panel ya lo muestra) y solo suben el daño con las oleadas. Idea: ganan experiencia con las bajas (más si las hacen ellos) y suben de nivel durante la partida, mejorando vida, daño y habilidades. Encaja con el árbol de mejoras y la campaña.
- **TODO: tienda del héroe** (28-10-2026): comprar mejoras o equipo para el héroe (con oro de la partida o con estrellas entre partidas). Por decidir qué se compra y con qué moneda.
- **TODO: fuente de curación** (o similar): un punto del mapa (o una estructura que se construye) donde el héroe se cura más deprisa, como alternativa a la retirada automática.
- Reina goblin (siguiente héroe).

**Estrellas y progreso**
- ✅ Explicación de las estrellas en la elección de mapa y en la pantalla final; con trucos no se ganan (v1.11).
- Idea: **estrellas como moneda** para un árbol de mejoras permanente (más oro inicial, torres más baratas, más vida a los héroes); encaja con el nivel y la tienda del héroe.
- Idea: estrellas propias del modo infinito (★ oleada 10, ★★ 20, ★★★ 30).

**Trucos**
- **TODO: más trucos con efectos visibles en partidas normales** (28-10-2026), por ejemplo: cabezones, enemigos diminutos o gigantes, lluvia de oro de verdad, torres doradas, noche cerrada, cámara lenta. Siguen sin dar estrellas, logros ni clasificación.
- **TODO: qué hacer con Thanos**: el truco `thanos`, el guantelete y su imagen (`thanos_snap.webp`) son de Marvel. Opciones: quitarlo, o rehacerlo como algo propio (p. ej. «el chasquido del goblin» con otro nombre, otra imagen y otro sonido).

**Idiomas**
- **TODO: castellano, catalán e inglés** (28-10-2026). Viable sin rehacer el juego: un módulo de textos (`t('clave')`) con un diccionario por idioma, `data-i18n` en el HTML, selector en Ajustes (por defecto, el idioma del navegador). Hay unas 500 frases repartidas sobre todo por `index.html`, `game.js`, `config.js` (nombres de torres, enemigos, héroes, mapas, habilidades), `main.js` y `achievements.js`; los mensajes de error de la API habría que traducirlos en el juego. Trabajo estimado: medio-grande, pero mecánico.

**Sonido**
- ✅ **Disparos e impactos de las torres** (hecho en v1.3, 15-10-2026; efectos por debajo de la música salvo Thanos): uno propio por torre (arena: chasquido; catapulta: madera y piedra; hielo: cristal; doble cañón: ráfaga; pesado: estampido grave; veneno: burbujeo; fuego: llamarada). Límite de sonidos simultáneos y siempre por debajo de la música.
- Sonidos de muerte de enemigos y aviso al aparecer cada jefe.
- Volumen separado para música, efectos y clima.

**Enemigos**
- Esbirro de apoyo con aura de mejoras (ver Fase 6).
- Muertes de jefes más elaboradas según el tipo.

**Mundo**
- Ciclo de día y noche.
- Más biomas: pantano y castillo en ruinas.

**Online**
- ✅ Hosting decidido: GitHub Pages + Vercel + MongoDB Atlas; administración con la app de escritorio.

**Presentación**
- **Transición de puertas al entrar en partida** (Jugar un mapa, Continuar, Siguiente nivel, Reintentar): la puerta del fondo se abre desde la separación del medio, cada hoja hacia su lado (algo de giro en perspectiva, la luz azul de las gemas apagándose) y detrás aparece el mapa elegido con un zoom desde el cielo hasta la cámara de juego. Extras: sonido de cerrojo y bisagras, polvo del marco y la transición inversa (las puertas se cierran) al salir al menú.
- Fondo de los menús cambiado a la nueva puerta con el dragón (15-10-2026); es la imagen que se abriría.

**Antes de publicar: derechos de autor**
- **TODO: música con derechos**: las pistas de los niveles del original no son libres (p. ej. *Twisted Treeline*, de Riot Games). Cambiarlas por música propia o libre, como la *Marcha del Goblin*.
- **TODO: imágenes con derechos**: revisar el origen de cada imagen de `www/assets/ui/` (portadas de victoria y derrota, fondos de menú…). `thanos_snap.webp` es de Marvel (ver Trucos). El GIF del ataúd (meme) ya está sustituido por una animación propia con los enemigos del juego (v1.11).

**Publicación y móvil (aparcado)**
- Acceso desde el móvil por WiFi desactivado (15-10-2026): el servidor solo escucha en el ordenador. Se mantienen los formatos de pantalla de móvil.
- Más adelante: rendimiento en móvil, APK y prueba en un móvil real.
- Renombrar el truco `thanos` y el guantelete si se publica en tiendas.

## Próximas decisiones

- [x] Guantelete: B
- [x] Enemigos: B (híbrido)
- [ ] Si se publicará en tiendas
- [x] Ranking online: GitHub Pages + Vercel + MongoDB Atlas
- [ ] Thanos: quitarlo o rehacerlo como algo propio
- [ ] Idiomas: cuándo hacer castellano, catalán e inglés
