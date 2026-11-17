import api from '../api.js';
import i18n from '../i18n.js';

// El telefono de la cuenta es obligatorio: es la via del admin para contactar
// a anfitriones, organizadores y turistas. Las cuentas antiguas sin telefono
// se mandan a su perfil para agregarlo.
export const profilePathFor = (role) => (role === 'host' ? '/host/profile' : '/profile');

export const phoneRequiredPath = (role) => `${profilePathFor(role)}?phone=required`;

// Datos de la cuenta desde el servidor (la sesion guardada no trae el telefono).
export async function fetchProfile() {
  try {
    const response = await api.get('/users/profile');
    return response.data || null;
  } catch {
    return null;
  }
}

export const phoneRequiredNotice = (role) => `
  <div class="phone-required-notice" role="alert">
    ${i18n.t('profile.phoneRequiredNotice')}
    <a href="${phoneRequiredPath(role)}" data-link>${i18n.t('profile.addPhone')}</a>
  </div>
`;
