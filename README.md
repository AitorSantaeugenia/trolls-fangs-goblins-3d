# Trolls, Fangs & Goblins 3D

> [!IMPORTANT]
> **🎮 Juega ahora: [trolls-fangs-goblins-3d.vercel.app](https://trolls-fangs-goblins-3d.vercel.app/)**
> Funciona en el navegador, sin instalar nada. Mejor en ordenador.

Tower defense en 3D para el navegador, hecho con **three.js**. Es un remake del *Trolls, Fangs and Goblins TD* original (Canvas 2D): 5 mapas, 7 torres, 3 héroes con habilidades, modo infinito con **clasificación online**, editor de mapas y **mapas de la comunidad**.

Pensado para el **navegador del ordenador**; la interfaz también se adapta a pantallas de móvil (táctil y en horizontal).

### El juego original

| | |
|---|---|
| Repositorio | [AitorSantaeugenia/Trolls-Fangs-and-Goblins-TD](https://github.com/AitorSantaeugenia/Trolls-Fangs-and-Goblins-TD) |
| Jugar al original | [trolls-fangs-td.web.app](https://trolls-fangs-td.web.app/) |

El proyecto original no se ha modificado: sus assets (sprites, texturas del camino, sonidos, música, logos) se han copiado y optimizado aquí, y sus caminos, oleadas y estadísticas se han conservado (ver [qué hay de nuevo](#3-qué-hay-de-nuevo-respecto-al-original)).

---

## 1. Jugar en tu ordenador

Necesitas [Node.js](https://nodejs.org/) (18 o más reciente). No hace falta instalar nada más para jugar.

```bash
node server.mjs
```

Abre **http://localhost:8080** en el navegador. El servidor solo escucha en tu ordenador (el acceso desde el móvil por WiFi está desactivado por ahora).

> No funciona abriendo `www/index.html` con doble clic: los módulos de JavaScript necesitan un servidor.

Las puntuaciones, los mapas de la comunidad y las visitas del servidor local se guardan en `data/scores.json` (se crea solo).

**Con MongoDB** (en tu ordenador o en Atlas): copia `.env.example` como `.env`, pon tu `MONGODB_URI`, ejecuta `npm install` una vez y arranca igual con `node server.mjs`, que lee el `.env` solo. El `.env` nunca se sube a Git.

**Publicarlo en internet**: GitHub Pages para el juego, Vercel para la API y MongoDB Atlas para los datos, todo en planes gratuitos. Paso a paso en [docs/DEPLOY.md](docs/DEPLOY.md).

**Límites contra el abuso**: cada jugador puede guardar como mucho **10 puntuaciones** y publicar **2 mapas** cada 24 horas.

**Administración**: se hace con una app de escritorio aparte (Electron) que se conecta directamente a la base de datos: visitas, jugadores, clasificación, mapas publicados y bloqueos, con opciones para editar, ocultar, borrar, renombrar o bloquear. No forma parte de este repositorio; la web publicada no tiene ningún panel de administración.

### Qué se guarda y dónde

| Qué | Dónde |
|---|---|
| Estrellas, Torre de Fuego desbloqueada, logros, récords del modo infinito, mapas creados, partida para «Continuar», ajustes y tu nombre para la clasificación | En el **navegador** de cada jugador (`localStorage`, clave `tfg3d-save-v1`) |
| Música subida a un mapa personalizado | En el **navegador** (IndexedDB `tfg3d-audio`) |
| Clasificación del modo infinito y mapas de la comunidad (de todos los jugadores) | En **MongoDB Atlas** (web publicada; colecciones `scores` y `maps`) o en `data/scores.json` (servidor propio o en tu ordenador) |
| Visitas (una por persona y día, con una huella anónima de la IP) y jugadores bloqueados | En el mismo sitio (colecciones `visits` y `bans`) |
| Partida en curso del modo infinito | No se guarda a medias, para que la clasificación sea justa |

---

## 2. Crear la app Android (APK) — aparcado

El juego no necesita ninguna dependencia de npm: three.js va incluido en `www/vendor/`.
Capacitor se ha quitado de `package.json` mientras la app está aparcada (sus herramientas, sobre todo `@capacitor/assets`, arrastraban avisos de seguridad de `npm audit` sin solución). `capacitor.config.json`, `assets/` y `tools/android-setup.mjs` se conservan para retomarlo.

Para retomarlo (requisitos: **Node 22+** y **Android Studio**):

```bash
npm install @capacitor/core@8 @capacitor/android@8
npm install -D @capacitor/cli@8
npx cap add android
node tools/android-setup.mjs           # horizontal + pantalla completa
npx @capacitor/assets generate --android   # icono y splash (puntual, sin instalarlo)
npx cap open android
```

En Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. Tras cambiar algo en `www/`: `npx cap sync android`.
**iOS** (Mac con Xcode): `npm install @capacitor/ios@8`, `npx cap add ios`, `npx cap open ios`.

---

## 3. Qué hay de nuevo respecto al original

| | Original (Canvas 2D) | Remake 3D |
|---|---|---|
| Gráficos | Mapas PNG planos | Terreno low-poly con colinas, luces, sombras y niebla por bioma; decorados, castillo, cueva y hoguera animada en 3D |
| Enemigos | Sprites | **Todo en 3D low-poly**: los 8 jefes con modelo propio (alas, colas, pasos, caída al morir) y los 30 aspectos de esbirros agrupados en 9 arquetipos con sus colores, dibujados con instanciado para que vaya fluido en móvil. En Ajustes se puede volver a los sprites originales |
| Muertes | Desaparecen | Según el tipo: huesos que saltan, llamas que se apagan, fantasmas que se desvanecen, estallidos del color del enemigo |
| Torres | Imágenes | Modelos 3D inspirados en los dibujos originales (cañón que apunta, catapulta que lanza, cristal de hielo, brasero) |
| Cámara | Fija | Girar, zoom y desplazar (ratón o gestos táctiles), botón para recentrar |
| Controles | Ratón | Ratón + **táctil** (colocar → confirmar ✓), atajos de teclado |
| Torres | Solo construir | **Mejorar** hasta nivel 3, **vender** (70 %) y elegir **a quién atacan** (primero, último, más fuerte, más cercano) |
| Proyectiles | Daño instantáneo | Proyectiles reales; la catapulta hace **daño en área** |
| Oleadas | Empiezan solas | Tiempo de preparación y botón para **llamar la oleada antes** (oro extra) |
| Ritmo | x1 | **x1 / x2 / x3** |
| Truco `thanos` | Sprite 2D del guantelete | **Guantelete 3D** con 6 gemas que baja, chasquea y convierte a los enemigos en polvo |
| Brillo | — | **Bloom** en lava, fuego, cristales y gemas (calidad Media y Alta) |
| Torres nuevas | Cañón Pesado y Doble Cañón bloqueados (sin terminar) | **Doble Cañón**, **Cañón Pesado** (área) y **Torre de Veneno** (daño continuo), con modelos 3D propios |
| Resistencias | — | Los voladores esquivan parte de piedras y obuses; los esbirros del Infierno resisten el fuego; el Señor de las Nieves apenas se congela y es débil al fuego |
| Modo infinito | — | Botón **∞** en cada mapa: las oleadas salen solas, sin cuenta atrás, cada vez más seguidas, grandes y con más jefes, hasta que caes. **Clasificación online** por mapa (nombre, oleada, bajas, héroe, torres, oro, daño y tiempo). Con trucos no se entra en la clasificación |
| Habilidades | — | **Lluvia de meteoritos** (eliges dónde, <kbd>Q</kbd>) y **Ventisca** (congela a todos, <kbd>W</kbd>), con recarga; su daño crece con las oleadas |
| Niveles | 4 | **5**: nuevo **Dunas del Escorpión** (Medio), bioma desierto con un camino que se cruza consigo mismo |
| Mapas de la comunidad | — | Los jugadores **publican** sus mapas del editor con nombre, nick y descripción; los demás los ven con **vista previa**, los juegan, los guardan o copian su código. Ordenados por nuevos o más jugados, con buscador y moderación |
| Editor de mapas | — | Dibuja tu propio camino sobre una cuadrícula, elige bioma, vidas, oro y oleadas, y juégalo (también en infinito). Se comparte con un **código** `TFG1:…` para copiar y pegar |
| Primer nivel | — | **Tutorial interactivo** la primera vez (se puede saltar o repetir desde Ajustes) |
| Progreso | — | **Estrellas** por nivel (★ ganar, ★★ con la mitad de las vidas, ★★★ con el 90 %; con trucos no cuentan); superar *Difícil* **desbloquea la Torre de Fuego** para siempre |
| Derrota | — | Seis enemigos del juego, elegidos al azar, se llevan tu ataúd a ritmo de marcha |
| Héroes | — | Tras elegir mapa se elige **héroe**: el **Chamán troll** (a distancia), **Colmillo** (cuerpo a cuerpo, frena a los enemigos), **Tuerca** (metralleta que se recalienta, cepos y minitorreta) o *Sin héroe* (clásico). Se coloca como una torre, se mueve por todo el mapa (en AUTO va solo a por los enemigos), recibe golpes y reaparece si cae; con héroe salen más esbirros |
| Panel del héroe | — | Estilo Warcraft III: **retrato 3D en vivo**, vida y energía, estadísticas y habilidades Q, W y **definitiva E** (se carga con las bajas), con efectos de luz y pintura inspirados en *Arcane* |
| Clima | — | **Clima dinámico** por bioma: lluvia y tormentas con rayos y truenos, niebla, ventisca, tormenta de arena, ceniza y lluvia de fuego |
| Guardado | — | La partida se guarda entre oleadas; botón **Continuar** en el menú |
| Logros | — | **25 logros** con aviso en partida y pantalla de logros |
| Calidad | — | Baja / Media / Alta / **Ultra** (por defecto en ordenador) |
| Dificultad | — | En Normal, Difícil e Infierno los enemigos ganan vida según avanzan las oleadas (equilibrado con un bot, ver abajo) |

Se mantienen: los 4 niveles originales con sus caminos exactos, vidas y oro iniciales, las oleadas (extraídas ejecutando el `wave.js` original), las estadísticas de torres y enemigos, la música de cada nivel, los sonidos y **todos los trucos**:

<details><summary>Trucos (pulsa <kbd>Enter</kbd>, o Pausa → Trucos en el móvil)</summary>

| Código | Efecto |
|---|---|
| `greedisgood` | +200 de oro |
| `hollymolly` | +1000 de oro |
| `whosyourdaddy` | Desbloquea la Torre de Fuego |
| `ezwin` | Victoria instantánea |
| `4lose` | Derrota instantánea |
| `thanos` | … |
| `ororo` | Lanza ya un fenómeno meteorológico al azar (solo si no hay ninguno en curso) |
</details>

---

## 4. Estructura

```
www/                  ← el juego (lo que publica GitHub Pages)
  index.html
  css/style.css
  js/
    config.js         datos: torres, enemigos, niveles, oleadas
    sim.js            lógica pura del juego (sin gráficos, se puede ejecutar en Node)
    view.js           escena 3D: cámara, enemigos, torres, proyectiles
    world.js          terreno, camino, luces y decorados de cada bioma
    models.js         modelos low-poly (torres, castillo, cueva, hoguera, decorados, guantelete)
    bosses.js         los 8 jefes en 3D con animación procedural
    minions3d.js      esbirros en 3D (9 arquetipos, InstancedMesh)
    fx.js             partículas, ondas, textos flotantes
    game.js           partida: entrada, HUD, construcción, mejoras, trucos
    heroes.js, heroview.js, heropanel.js, gadgets.js   héroes en 3D, su panel y los artilugios de Tuerca
    weather.js        clima dinámico por bioma
    main.js           menús y arranque
    tutorial.js       tutorial del primer nivel
    editor.js         editor de mapas
    custom.js         mapas propios: guardado, registro y códigos para compartir
    community.js, mapdraw.js   mapas de la comunidad y sus vistas previas
    leaderboard.js    clasificación del modo infinito
    apiconfig.js      dirección de la API (REMOTE_API) cuando el juego está en GitHub Pages
    achievements.js, coffin.js, audio.js, assets.js, save.js, util.js
  vendor/             three.js r170 + post-procesado (local, funciona sin internet)
  assets/             sprites, texturas, sonidos, fuentes
assets/               icono y splash para la app (para @capacitor/assets, cuando se retome)
tools/
  balance.mjs         bot que juega todos los niveles para comprobar el equilibrio
  dev/                páginas de las herramientas (retratos 3D, iconos); el servidor local las sirve en /dev/, no se publican
  android-setup.mjs   ajustes del proyecto Android (horizontal, pantalla completa)
api/index.js          función de Vercel: la API de la clasificación contra MongoDB Atlas
lib/                  API pública compartida (rutas, validación, límites diarios, bloqueos, visitas) y almacenes JSON y MongoDB
server.mjs            servidor local o de un VPS (juego + API, clasificación en data/scores.json)
vercel.json           configuración de Vercel
.github/workflows/    publicación automática en GitHub Pages (copia de docs/github-pages.yml)
docs/                 DEPLOY.md (cómo publicarlo), planning.md (plan y pendientes)
.env.example          plantilla del .env para el servidor local
capacitor.config.json
```

Para reequilibrar: cambia valores en `www/js/config.js` y ejecuta `npm run balance`. Opciones: `node tools/balance.mjs hard --skill=0.5` (jugador menos preciso), `--plan=new|double|heavy|poison|classic` (qué torres usa el bot), `--flame` y `--endless` (cuántas oleadas aguanta en infinito).

---

## Créditos y licencia

Basado en *Trolls, Fangs and Goblins TD* de **Aitor Santaeugenia** ([repositorio original](https://github.com/AitorSantaeugenia/Trolls-Fangs-and-Goblins-TD), CC BY-NC-SA). Este remake mantiene la misma licencia: **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es)** (reconocimiento, no comercial, compartir igual). Detalles en [LICENSE](LICENSE).
three.js © mrdoob y colaboradores (MIT). Fuentes Cinzel (SIL Open Font License).

> **Versión de prueba.** Algunas pistas de música y sonidos vienen del juego original y **no son de uso libre** (por ejemplo, *Twisted Treeline* es de League of Legends, © Riot Games), igual que la imagen y los sonidos del truco `thanos` (Marvel). No están cubiertos por la licencia del proyecto y se sustituirán por material propio o libre.

**Música propia.** La pista **Marcha del Goblin** (`goblinMarch.mp3`) es un tema original compuesto por código para este remake (`python3 tools/compose_theme.py` la vuelve a generar) y se puede usar libremente con la licencia del proyecto: es la música por defecto de los mapas creados con el editor.
