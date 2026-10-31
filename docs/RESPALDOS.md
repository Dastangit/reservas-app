# Respaldos de la base (MongoDB Atlas)

El clúster de Atlas es el plan gratis (M0), que **no tiene respaldos automáticos**: si se borra algo, Atlas no lo puede recuperar. Por eso hay un respaldo diario propio.

## Cómo funciona hoy (en la PC)

- Un temporizador de systemd del usuario (`reservas-respaldo.timer`) corre `backend/scripts/backup.js` todos los días a las 14:00. Si la PC estaba apagada, corre al encenderla.
- Guarda cada respaldo en `~/Dastan/respaldos/reservas/<fecha>/`: un `.jsonl.gz` por colección y un `manifest.json` con cuántos documentos tiene cada una. Una carpeta sin `manifest.json` es un respaldo que no terminó.
- Conserva los **últimos 14**; borra solo respaldos completos y más viejos, nunca otras carpetas.
- **Contiene datos personales y hashes de contraseñas:** las carpetas son 700 y los archivos 600. Nunca los subas a git ni los compartas.
- Si falla, avisa al grupo de Telegram (si `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están en `backend/.env`). El aviso no lleva datos de la base.
- Los archivos del temporizador están en `deploy/pc/`. Para instalarlo o actualizarlo: `deploy/pc/instalar-respaldo.sh`.

Primer respaldo real: 31 oct 2026 (16 colecciones, 24 documentos), restaurado con éxito en una base temporal.

## Comandos

```bash
systemctl --user list-timers reservas-respaldo.timer   # cuándo toca el próximo
systemctl --user start reservas-respaldo.service       # respaldar ahora
journalctl --user -u reservas-respaldo -n 40           # qué pasó en el último
ls ~/Dastan/respaldos/reservas/                        # respaldos guardados
```

## Restaurar

`backend/scripts/restore.js` carga un respaldo en la base de `MONGODB_URI` (la de `backend/.env`, que es la real):

```bash
cd backend
node scripts/restore.js ~/Dastan/respaldos/reservas/<fecha>                     # solo en colecciones vacías
node scripts/restore.js ~/Dastan/respaldos/reservas/<fecha> --only bookings     # una o varias colecciones (separadas por coma)
node scripts/restore.js ~/Dastan/respaldos/reservas/<fecha> --replace           # BORRA lo que haya y restaura
```

- Sin `--replace` se niega a escribir en una colección que ya tenga documentos.
- Los índices no van en el respaldo: Mongoose los crea al reiniciar el backend.
- Acepta también los respaldos viejos sin comprimir (`.jsonl`).
- Las pruebas (`tests/backup.test.js`) respaldan, vacían y restauran una base en memoria en cada `npm test`.

## Pendiente: con el VPS

La PC no siempre está encendida y la copia vive en un solo disco. Cuando el backend esté en el VPS:
- correr el mismo respaldo con cron en el servidor, dentro del contenedor `reservas`;
- mandar una copia a Cloudflare R2 (gratis hasta 10 GB), en un bucket propio, separado del de Up;
- dejar el temporizador de la PC como segunda copia.
