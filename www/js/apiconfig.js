// Dónde está la API de la clasificación del modo infinito.
//
// · En tu ordenador (localhost) o si el juego lo sirve el propio servidor (VPS o Vercel), la API está en el mismo sitio.
// · En GitHub Pages no hay servidor: escribe aquí la dirección de tu proyecto de Vercel, con la barra final,
//   por ejemplo 'https://tfg3d.vercel.app/'. Pasos completos en docs/DEPLOY.md.
export const REMOTE_API = '';

const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
export const API_BASE = REMOTE_API && !local && !REMOTE_API.startsWith(location.origin) ? REMOTE_API : '';
