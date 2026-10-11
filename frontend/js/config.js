const APP_CONFIG = {
  app_name: 'Elysio Experiences',
  app_tagline: 'Viaja con confianza',
  app_logo: '/assets/logo-elysio.svg',

  // Contacto publico (footer, confirmaciones). Cambiar aqui cuando haya
  // email y WhatsApp de empresa. Los textos legales (locales/*.json) tambien
  // los mencionan: actualizarlos a la vez.
  admin_email: 'elysio.support@gmail.com',
  whatsapp: '+16055003653',

  social: {},

  fee: {
    amount: 7,
    currency: 'USD',
    display: '$7 USD',
    refundable: false,
  },

  features: {
    experiences_module: true,
    community_module: false,
    dark_mode: false,
  },
};

window.APP_CONFIG = APP_CONFIG;
