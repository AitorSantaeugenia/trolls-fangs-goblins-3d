// Dónde está la API de la clasificación del modo infinito.
//
// · En tu ordenador (localhost) o si el juego lo sirve el propio servidor (VPS o Vercel), la API está en el mismo sitio.
// · En GitHub Pages no hay servidor: escribe aquí la dirección de tu proyecto de Vercel, con la barra final,
//   por ejemplo 'https://tfg3d.vercel.app/'. Pasos completos en docs/DEPLOY.md.
export const REMOTE_API = 'https://trolls-fangs-goblins-3d.vercel.app/';

// Con API propia en la misma dirección: el ordenador (localhost) y cualquier dirección de Vercel
// (la principal y las de cada despliegue, tipo trolls-fangs-goblins-3d-xxxx-….vercel.app).
const host = location.hostname;
const sameOrigin = ['localhost', '127.0.0.1', ''].includes(host) || host.endsWith('.vercel.app');
export const API_BASE = REMOTE_API && !sameOrigin && !REMOTE_API.startsWith(location.origin) ? REMOTE_API : '';
