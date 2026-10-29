# Publicar el juego en internet

Montaje elegido (todo en planes gratuitos):

| Pieza | Qué hace | Dónde |
|---|---|---|
| **GitHub Pages** | Sirve el juego (la carpeta `www/`) | `https://<usuario>.github.io/<repositorio>/` |
| **Vercel** | La API pública (`api/index.js`): guarda y lee puntuaciones, mapas de la comunidad y visitas, con límites contra el abuso | `https://<proyecto>.vercel.app/api/…` |
| **MongoDB Atlas** (M0 gratis) | La base de datos de la clasificación, los mapas de la comunidad, las visitas y los bloqueos | la nube de MongoDB |
| **App de administración** (`admin-app/`) | Programa de escritorio (Electron) que se conecta directamente a Atlas para verlo y gestionarlo todo | tu ordenador (no se sube a GitHub) |

¿Por qué hace falta Vercel en medio? GitHub Pages solo sirve archivos: no puede guardar nada ni esconder contraseñas. Y MongoDB retiró en 2025 su «Data API», así que el navegador no puede hablar con Atlas directamente (tampoco sería seguro: la contraseña de la base de datos quedaría a la vista de cualquiera). La función de Vercel es la única que conoce esa contraseña.

El progreso de cada jugador (estrellas, logros, mapas creados, récords) sigue guardándose en su navegador, como siempre.

---

## 1. GitHub: el repositorio y GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `trolls-fangs-goblins-3d`. Para GitHub Pages gratis tiene que ser **público**.
2. Sube el proyecto (desde la carpeta del proyecto, en PowerShell):

   ```bash
   git init
   git add .
   git commit -m "Trolls, Fangs and Goblins 3D"
   git branch -M main
   git remote add origin https://github.com/<usuario>/trolls-fangs-goblins-3d.git
   git push -u origin main
   ```

   `.gitignore` ya deja fuera `node_modules/`, `data/` (la clasificación local), los `.env` y la carpeta `admin-app/` (la app de administración no se publica).
3. Copia `docs/github-pages.yml` a **`.github/workflows/pages.yml`** (crea esas carpetas; el nombre empieza por punto). También puedes crearlo desde la web de GitHub: **Add file → Create new file**, escribe `.github/workflows/pages.yml` como nombre y pega el contenido.
4. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. El flujo `.github/workflows/pages.yml` publica `www/` cada vez que subes algo a `main`. En la pestaña **Actions** verás cómo se publica; al terminar, el juego está en `https://<usuario>.github.io/trolls-fangs-goblins-3d/`.

En este punto el juego ya se puede jugar; la clasificación dirá «no disponible» hasta el paso 4.

## 2. MongoDB Atlas: la base de datos

1. Crea una cuenta en MongoDB Atlas y un clúster **gratis (M0)**. Elige una región de Europa (Fráncfort, París, Irlanda…).
2. **Database Access** → añade un usuario con contraseña (rol de lectura y escritura). Apunta usuario y contraseña.
3. **Network Access** → añade `0.0.0.0/0` (permitir desde cualquier sitio). Vercel no tiene una IP fija, así que hace falta; la base de datos sigue protegida por el usuario y la contraseña.
4. **Connect → Drivers** → copia la cadena de conexión. Se parece a:

   ```
   mongodb+srv://USUARIO:CONTRASEÑA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Sustituye la contraseña. No hay que crear nada más: la base de datos `tfg3d` y sus colecciones se crean solas con la primera puntuación.

## 3. Vercel: la API

1. Entra en Vercel con tu cuenta de GitHub → **Add New → Project** → importa el mismo repositorio.
2. *Framework Preset*: **Other**. No hace falta comando de compilación (lo indica `vercel.json`).
3. **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la cadena de conexión del paso 2 |
   | `MONGODB_DB` | opcional; por defecto `tfg3d` |
   | `ALLOWED_ORIGINS` | `https://<usuario>.github.io` (sin la ruta del repositorio) |

4. **Deploy**. Comprueba que funciona abriendo `https://<proyecto>.vercel.app/api/health`. Debe responder `{"ok":true,"store":"mongo"}`.
5. Recomendado: en el proyecto, **Settings → Functions → Region**, elige la región de Europa más cercana a la de Atlas (por ejemplo `fra1` si Atlas está en Fráncfort). Así cada consulta va más rápida.

Extra: Vercel también publica el juego en `https://<proyecto>.vercel.app/` (con la API en la misma dirección). Puedes usar cualquiera de las dos webs.

## 4. Conectar el juego con la API

En `www/js/apiconfig.js` pon la dirección de Vercel, con la barra final:

```js
export const REMOTE_API = 'https://<proyecto>.vercel.app/';
```

Sube el cambio (`git commit -am "API de la clasificación"` y `git push`). GitHub Pages se vuelve a publicar solo. En tu ordenador (`localhost`) el juego sigue usando tu servidor local, así que puedes dejarlo puesto.

## 5. Administración: la app de escritorio

La web ya no tiene panel de administración (ni contraseña que adivinar): todo se gestiona con el programa de la carpeta `admin-app/`, que habla **directamente con Atlas** desde tu ordenador. Instrucciones en `admin-app/README.md`. En resumen:

```bash
cd admin-app
npm install
npm run dev        # abrirla
npm run build      # crear dist/TFG3D-Admin-1.0.0.exe (portátil: doble clic y listo)
```

La primera vez, en **Conexión**, pega la misma cadena de `MONGODB_URI` (o ponla en `admin-app/.env`). Se guarda cifrada en tu usuario de Windows. Desde la app:

- **Resumen**: visitas de hoy, 7 y 30 días (y personas distintas), gráfica de 30 días, récord de cada mapa, mapas más jugados y actividad reciente.
- **Jugadores**: cada jugador se agrupa por la huella anónima de su IP, con los nombres que ha usado, puntuaciones, mapas y visitas. Puedes **renombrarlo** en todo (puntuaciones y mapas a la vez), **borrar todo** lo que publicó y **bloquearlo**.
- **Clasificación**: por mapa, con búsqueda; **editar**, **ocultar** o **borrar** (también varias a la vez).
- **Mapas**: los de la comunidad con su vista previa; editar nombre, nick, descripción y partidas, ocultar, borrar, copiar el código o bloquear al autor.
- **Bloqueos**: quién está bloqueado y por qué; desbloquear.
- **Copia de seguridad**: guarda todo en un JSON (el plan gratis de Atlas no hace copias automáticas).

Un jugador **bloqueado** puede seguir jugando y mirando la clasificación, pero la API rechaza sus puntuaciones y mapas.

### Límites contra el abuso

La API los aplica a cada jugador (huella de su IP), en `lib/scores-api.mjs` (`LIMITS`):

| Qué | Límite |
|---|---|
| Puntuaciones guardadas | **10 cada 24 h** |
| Mapas publicados | **2 cada 24 h** (un mapa con el mismo código que otro ya publicado se rechaza, y uno no válido no gasta cupo) |
| Envíos en general | 20 cada 10 minutos |
| Visitas | se cuenta una por persona y día (con su número de páginas vistas) |

## Actualizar el juego

Cada `git push` a `main` vuelve a publicar GitHub Pages y Vercel a la vez. La clasificación no se toca.

---

## Datos guardados

Cada puntuación (en Atlas, colección `scores`; en local, `data/scores.json`):

```json
{ "id": "2bff4bcd2492", "name": "Darkstein", "level": "hard", "hero": "gunner",
  "wave": 14, "kills": 520, "towers": 30, "gold": 6000, "damage": 250000, "time": 600,
  "date": "2026-10-27T21:22:01.580Z", "version": "1.8.0", "ipHash": "8e9c1717db6574e9" }
```

Cada mapa de la comunidad (colección `maps`; en local, la lista `maps` del mismo JSON):

```json
{ "id": "e7edd4037bdb", "name": "Serpiente de hielo", "author": "Darkstein",
  "desc": "Una serpiente larga sobre el glaciar…", "code": "TFG1:eyJuIjoi…",
  "biome": "snow", "preset": "hard", "hp": 15, "gold": 700, "turns": 4,
  "date": "2026-10-28T15:20:11.000Z", "plays": 1, "ipHash": "3670be4765240dfd" }
```

`code` es el mismo código que da el editor: de él salen la vista previa y el mapa jugable. `turns` son las curvas del camino.

En las puntuaciones, `hero` es `null` sin héroe. `time` va en segundos de juego. `ipHash` es una huella anónima de la IP (no se guarda la IP), útil para ver si muchas puntuaciones vienen del mismo sitio. Una puntuación oculta lleva `"hidden": true`. Un mapa oculto también lleva `"hidden": true`. Además:

- `visits`: una fila por persona (huella) y día, `{ day, ipHash, n, first, last }`; se borran solas a los ~400 días.
- `bans`: los bloqueados, `{ ipHash, reason, names, date }`.
- `limits`: los envíos recientes de cada huella para los límites diarios; se borran solos.
- `meta`: una clave aleatoria para calcular las huellas.

## Probar en tu ordenador

```bash
# con el JSON local (data/scores.json)
node server.mjs
# contra tu base de datos de Atlas (necesita «npm install» una vez)
npm install
$env:MONGODB_URI="mongodb+srv://…"; node server.mjs
```

O, sin escribirla cada vez: copia `.env.example` como `.env` en la carpeta del proyecto y pon ahí `MONGODB_URI` (y `MONGODB_DB`). `node server.mjs` lo lee al arrancar. El `.env` está en `.gitignore`: nunca se sube.

La app de administración, abierta con el servidor local en marcha, encuentra sola `data/scores.json` y se conecta a él; los cambios que hagas los ve el servidor al momento.

## Alternativa: un servidor propio (VPS)

Si algún día prefieres no depender de Vercel ni de Atlas: un VPS pequeño con Node 18+ ejecutando `node server.mjs` (variables `HOST=0.0.0.0`, `DATA_DIR`, `TRUST_PROXY=1`) detrás de Caddy para el HTTPS. Sirve el juego y la API a la vez y guarda la clasificación en `data/scores.json` (con copia `scores.json.bak`). Para mirarla o gestionarla, la app de administración se conecta a ese `scores.json` (si la ejecutas en el servidor) o a una copia.

## Antes de abrirlo al público

- **Música con derechos**: las canciones originales de los niveles no tienen licencia libre, y con un repositorio público cualquiera puede descargarlas. Conviene cambiarlas por música libre (como *Goblin March*, que es nuestra) antes de publicar.
- **Truco `thanos`**: renombrarlo y cambiar el guantelete si se publica de forma comercial.
- **Partidas guardadas**: el progreso vive en el navegador de cada jugador. En la web nueva cada uno empieza de cero, también tú (lo que tienes en `localhost` no se pasa solo).
