# Mudanza del backend al VPS compartido con Up

Revisado el 30 de octubre de 2026. Hoy el backend corre en Render (`booking-platform-f8co.onrender.com`) y el frontend en Vercel. El plan es mover **solo el backend** al VPS de Hostinger que se va a contratar para Up (el proyecto de `../Up-Project`). El frontend puede quedarse en Vercel.

**Estado:** pendiente. Primero hay que comprar el VPS y desplegar Up; después se muda esto.

## Por qué cabe en el mismo servidor

- **La base no ocupa el VPS:** está en MongoDB Atlas (el clúster de `MONGODB_URI`).
- **Las fotos tampoco:** van a Cloudinary.
- **El backend es liviano:** Express en Docker (`backend/Dockerfile`, Node 24), con unos 100 a 200 MB de memoria.
- **El servidor de Up ya está preparado** para otros proyectos:
  - Cada proyecto lleva un archivo `.caddy` en `/opt/up/sitios`.
  - Los contenedores se unen a la red Docker `sitios`.
  - `infra/servidor.sh sitios` (desde `Up-Project`) lo activa sin cortar Up.
  - Up tiene prioridad de memoria: si otro proyecto agota la RAM, Linux cierra primero lo ajeno.
  - Guía completa: `Up-Project/docs/servidor.md`, sección «Otros proyectos en el mismo servidor».
- **Mejora respecto a Render:** el backend ya no se "duerme", así que la primera visita no tarda.

### Memoria estimada en el KVM 2 (8 GB)

| Qué | Memoria |
|---|---|
| Up (PostgreSQL, API y Caddy) | ~1–1.5 GB |
| OSRM (mapa de rutas de Up) | ~0.5 GB; 1.3 GB el día que se actualiza (una vez al mes) |
| n8n y recepcionista de WhatsApp | ~0.5–1 GB |
| Reservas (backend) | ~0.2 GB |
| **Libre** | **~4 GB** |

Con el KVM 1 (4 GB) y n8n también, quedaría muy justo: no recomendado.

## Ya preparado (30 oct 2026)

- **Node 24** en `backend/Dockerfile` y en el CI (Node 20 dejó de recibir parches de seguridad en abril de 2026). Lint y las 69 pruebas pasan.
- **Carpeta `deploy/`** con todo lo del servidor:
  - `docker-compose.yml`: contenedor `reservas`, `mem_limit: 512m`, red `sitios`, sin `ports`, con verificación de salud (`/health`) y registro limitado a 30 MB.
  - `reservas.caddy`: plantilla del sitio (HTTPS, `reverse_proxy reservas:3000`).
  - `env.produccion.example`: plantilla del `.env` del servidor, con todas las variables que lee el backend.
  - `desplegar.sh`: despliega con un solo comando (detalle abajo). Probado con `ssh`, `scp`, `docker` y `curl` simulados; el primer despliegue real es la verificación.
- **Dirección del backend en un solo comando:** `node frontend/scripts/api-base.js https://api.elysioexperiences.com` la cambia en `vercel.json` y `middleware.js`. Sin argumento, revisa que coincidan; el CI lo corre en cada push.

### Cómo funciona `deploy/desplegar.sh`

- Toma la IP, el usuario y la llave del servidor de Up (`../Up-Project/infra/.destino.json`). Lo que se indique con `--ip`, `--usuario`, `--llave` o `--dominio` se recuerda en `deploy/.destino.json` (fuera de git).
- Sin `--dominio` usa `reservas.<ip-con-guiones>.sslip.io`: sirve para probar antes de tocar el DNS.
- Sube **lo que está en git** (`HEAD` de `backend/`); si hay cambios sin commit en `backend/`, se detiene.
- **La primera vez** crea `/opt/reservas/.env` con los secretos de JWT al azar y se detiene: hay que copiar las llaves de Render directo en el servidor (`nano /opt/reservas/.env`, el comando exacto lo imprime) y volver a correrlo.
- Después arma la imagen en el servidor, espera a que `/health` responda, publica el sitio en el Caddy de Up (con `revisar-sitios.sh`, que aparta un `.caddy` roto para no tumbar Up) y prueba `https://<dominio>/health`.
- Pone `API_URL` igual al dominio en cada despliegue: es la dirección a la que QvaPay avisa los pagos.
- `deploy/desplegar.sh estado` (salud y memoria) y `deploy/desplegar.sh logs` (registro en vivo).
- La versión anterior queda en `/opt/reservas/app.anterior`.

## Pendientes

### Antes de mudar
- [ ] Elegir el dominio del backend, p. ej. `api.elysioexperiences.com`, y confirmar dónde se maneja el DNS de `elysioexperiences.com`.
- [x] Respaldos: Atlas es M0 (sin respaldos automáticos). Desde el 31 oct 2026 hay respaldo diario en la PC; ver `docs/RESPALDOS.md`.
- [ ] Antes de cada despliegue, commit de lo que haya en `backend/`: `desplegar.sh` no sube lo que no está en git.

### El día de la mudanza (con Up ya desplegado)
1. [ ] **MongoDB Atlas → Network Access:** agregar la IP del VPS. Sin esto, el backend no conecta a la base.
2. [ ] `deploy/desplegar.sh` (primera vez: crea el `.env` y se detiene).
3. [ ] Llenar `/opt/reservas/.env` en el servidor con los valores de Render → Environment. Las llaves nunca por chat ni en git.
4. [ ] `deploy/desplegar.sh` otra vez. Debe terminar con «Listo» y la dirección `sslip.io`.
5. [ ] **DNS:** registro A del dominio del backend → IP del VPS. Luego `deploy/desplegar.sh --dominio api.elysioexperiences.com`.
6. [ ] `node frontend/scripts/api-base.js https://api.elysioexperiences.com`, commit y desplegar el frontend en Vercel.

### Después
- [ ] Probar todo el flujo: entrar, buscar, reservar, pagar con QvaPay y avisos push.
- [ ] CORS no necesita cambios: el navegador llama a `/api` en el mismo dominio de Vercel y Vercel lo reenvía. Solo si algún día el frontend llama directo al backend, agregar su dominio a `FRONTEND_URL` o `allowedOrigins` (`app.js`).
- [ ] Las tareas programadas (`jobs/`) corren en el mismo proceso web. No hace falta `worker.js`; debe haber **un solo** contenedor.
- [ ] **Respaldos:** los de Up no cubren esta base (está en Atlas). Pasar el respaldo diario al VPS con copia a R2 (`docs/RESPALDOS.md`, «Pendiente: con el VPS»).
- [ ] Monitor de UptimeRobot a `https://api.elysioexperiences.com/health`.
- [ ] Cuando todo funcione unos días, apagar el servicio de Render. Mientras siga encendido, los pagos de QvaPay que se crearon antes de la mudanza avisan allí.

## Ya está bien (no tocar)

- `app.set('trust proxy', 1)` en `app.js`: detrás de Caddy hay un solo proxy, así que el límite de peticiones ve la IP real.
- La ruta `/health` existe y sirve para vigilar el backend (por ejemplo con UptimeRobot).
