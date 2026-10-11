FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copiar solo los manifiestos primero -- así Docker cachea la capa de
# dependencias y no reinstala todo en cada build si el código cambia pero
# las dependencias no. `npm ci` instala exactamente el package-lock
# (desde registry.npmjs.org, ver .npmrc).
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

# Ahora sí, el resto del código del backend.
COPY --chown=node:node . .

# No correr como root dentro del contenedor.
USER node

# Render/SnapDeploy inyectan PORT como variable de entorno; el código ya
# lee env.port desde config/env.js, así que no hace falta hardcodear nada aquí.
EXPOSE 3000

CMD ["node", "server.js"]
