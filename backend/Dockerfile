FROM node:20-alpine

WORKDIR /app

# Copiar solo package.json primero -- así Docker cachea la capa de
# dependencias y no reinstala todo en cada build si el código cambia pero
# las dependencias no.
COPY package*.json ./
RUN npm install --omit=dev

# Ahora sí, el resto del código del backend.
COPY . .

# Render/SnapDeploy inyectan PORT como variable de entorno; el c\u00f3digo ya
# lee env.port desde config/env.js, as\u00ed que no hace falta hardcodear nada aqu\u00ed.
EXPOSE 3000

CMD ["npm", "start"]
