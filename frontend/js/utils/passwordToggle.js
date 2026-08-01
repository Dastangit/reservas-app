// Botón de mostrar/ocultar contraseña (👁️), reutilizable en cualquier campo
// de password. Uso: colocar el botón justo después del <input>, con
// data-target apuntando al id del input.

export function passwordToggleButton(inputId) {
  return `<button type="button" class="password-toggle-btn" data-target="${inputId}" onclick="togglePasswordVisibility('${inputId}')" aria-label="Mostrar contraseña" tabindex="-1">\u{1F441}\u{FE0F}</button>`;
}

if (typeof window !== 'undefined' && !window.togglePasswordVisibility) {
  window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    const btn = document.querySelector(`.password-toggle-btn[data-target="${inputId}"]`);
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    if (btn) btn.textContent = isHidden ? '\u{1F648}' : '\u{1F441}\u{FE0F}';
  };
}
