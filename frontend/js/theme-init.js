// Aplica el tema guardado antes de pintar la pagina (se carga sin defer en el
// <head>): sin esto, quien eligio "oscuro" veria un destello claro al entrar.
// Sin eleccion guardada no se pone nada y manda prefers-color-scheme (theme.css).
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
  } catch (e) {
    // localStorage bloqueado: se sigue el tema del sistema.
  }
}());
