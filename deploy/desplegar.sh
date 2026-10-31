#!/usr/bin/env bash
# Sube el backend de reservas al VPS que comparte con Up (ver docs/MUDANZA-VPS.md).
#
#     deploy/desplegar.sh                                   # despliega lo que esta en git (HEAD)
#     deploy/desplegar.sh --dominio api.elysioexperiences.com
#     deploy/desplegar.sh --ip 31.97.10.20 --usuario root --llave ~/.ssh/up_vps
#     deploy/desplegar.sh logs                              # registro del backend en vivo (Ctrl+C para salir)
#     deploy/desplegar.sh estado                            # si el contenedor esta sano y cuanta memoria usa
#
# La IP, el usuario y la llave se toman de Up (../Up-Project/infra/.destino.json, o UP_PROYECTO).
# Lo que indiques aqui se recuerda en deploy/.destino.json (no se sube a git).
# Sin --dominio se usa reservas.<ip-con-guiones>.sslip.io, que funciona sin tocar el DNS.
#
# Antes: Up ya desplegado en ese servidor (crea la red `sitios` y el Caddy).
set -euo pipefail

DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$DEPLOY")"
ARCHIVO_DESTINO="$DEPLOY/.destino.json"
DESTINO_UP="${UP_PROYECTO:-$RAIZ/../Up-Project}/infra/.destino.json"
REMOTO=/opt/reservas

fallar() { echo "Error: $*" >&2; exit 1; }
paso() { printf '\033[36m== %s\033[0m\n' "$*"; }
ayuda() { sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

accion=desplegar arg_ip="" arg_usuario="" arg_llave="" arg_dominio=""
while [[ $# -gt 0 ]]; do
	case $1 in
	--ip) arg_ip=${2:?falta la IP}; shift ;;
	--usuario) arg_usuario=${2:?falta el usuario}; shift ;;
	--llave) arg_llave=${2:?falta la llave}; shift ;;
	--dominio) arg_dominio=${2:?falta el dominio}; shift ;;
	logs | estado) accion=$1 ;;
	-h | --help) ayuda ;;
	*) echo "Opcion desconocida: $1" >&2; ayuda 1 ;;
	esac
	shift
done

command -v jq >/dev/null || fallar "falta jq (sudo pacman -S jq)"
leer() { [[ -f $2 ]] && jq -r ".$1 // empty" "$2" || true; }

# Lo indicado ahora gana; despues, lo recordado aqui; despues, lo de Up.
IP=${arg_ip:-$(leer Ip "$ARCHIVO_DESTINO")}; IP=${IP:-$(leer Ip "$DESTINO_UP")}
USUARIO=${arg_usuario:-$(leer Usuario "$ARCHIVO_DESTINO")}; USUARIO=${USUARIO:-$(leer Usuario "$DESTINO_UP")}; USUARIO=${USUARIO:-root}
LLAVE=${arg_llave:-$(leer Llave "$ARCHIVO_DESTINO")}; LLAVE=${LLAVE:-$(leer Llave "$DESTINO_UP")}; LLAVE=${LLAVE:-$HOME/.ssh/up_vps}
DOMINIO=${arg_dominio:-$(leer Dominio "$ARCHIVO_DESTINO")}
[[ -n $IP ]] || fallar "falta la IP del servidor: despliega Up primero (infra/desplegar.sh) o usa --ip"
DOMINIO=${DOMINIO:-reservas.${IP//./-}.sslip.io}
[[ $DOMINIO =~ ^[a-z0-9.-]+$ ]] || fallar "dominio no valido: $DOMINIO"
[[ -f $LLAVE ]] || fallar "no existe la llave $LLAVE. Indica otra con --llave."

SSH_OPC=(-i "$LLAVE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o ServerAliveInterval=15)
ANFITRION="$USUARIO@$IP"
remoto() { ssh "${SSH_OPC[@]}" "$ANFITRION" "$1" || fallar "fallo en el servidor: $1"; }

case $accion in
logs) exec ssh -t "${SSH_OPC[@]}" "$ANFITRION" "docker logs -f --tail 100 reservas" ;;
estado)
	remoto "docker inspect -f 'Estado: {{.State.Status}}, salud: {{.State.Health.Status}}, desde {{.State.StartedAt}}' reservas && docker stats --no-stream reservas"
	exit 0
	;;
esac

jq -n --arg Ip "$IP" --arg Usuario "$USUARIO" --arg Llave "$LLAVE" --arg Dominio "$DOMINIO" \
	'{Ip: $Ip, Usuario: $Usuario, Llave: $Llave, Dominio: $Dominio}' >"$ARCHIVO_DESTINO"

# Se sube exactamente lo que esta en git, para que el servidor no reciba cambios a medias.
# (--ignore-cr-at-eol: los finales de linea de Windows no cuentan como cambio.)
if [[ -n $(git -C "$RAIZ" diff HEAD --ignore-cr-at-eol --stat -- backend) ]]; then
	git -C "$RAIZ" diff HEAD --ignore-cr-at-eol --stat -- backend
	fallar "backend/ tiene cambios sin commit (arriba). Haz commit primero: se despliega HEAD."
fi
version=$(git -C "$RAIZ" rev-parse --short HEAD)

paso "Revisando el servidor $ANFITRION"
remoto "docker network inspect sitios >/dev/null 2>&1" ||
	fallar "no existe la red sitios: primero despliega Up en este servidor"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$RAIZ" archive --format=tar.gz -o "$tmp/app.tar.gz" HEAD:backend
sed -e '/^#/d' -e "s/^DOMINIO_API {/$DOMINIO {/" "$DEPLOY/reservas.caddy" >"$tmp/reservas.caddy"

paso "Subiendo la version $version"
remoto "mkdir -p $REMOTO"
scp "${SSH_OPC[@]}" -q "$tmp/app.tar.gz" "$DEPLOY/docker-compose.yml" "$DEPLOY/env.produccion.example" \
	"$tmp/reservas.caddy" "$ANFITRION:$REMOTO/" || fallar "no se pudieron subir los archivos"

# El .env se crea una sola vez, con los secretos de JWT al azar; despues solo cambia API_URL.
if ! ssh "${SSH_OPC[@]}" "$ANFITRION" "test -f $REMOTO/.env"; then
	remoto "cd $REMOTO && umask 077 && sed -e \"s|^JWT_SECRET=\$|JWT_SECRET=\$(openssl rand -hex 32)|\" \
		-e \"s|^JWT_REFRESH_SECRET=\$|JWT_REFRESH_SECRET=\$(openssl rand -hex 32)|\" \
		-e \"s|^API_URL=.*|API_URL=https://$DOMINIO|\" env.produccion.example >.env"
	echo
	echo "Se creo $REMOTO/.env. Faltan las llaves (MONGODB_URI, Cloudinary, QvaPay...)."
	echo "Copialas de Render (Environment) directo en el servidor:"
	echo "    ssh -i $LLAVE $ANFITRION nano $REMOTO/.env"
	echo "Despues vuelve a correr deploy/desplegar.sh."
	exit 0
fi
remoto "grep -q '^MONGODB_URI=.' $REMOTO/.env" ||
	fallar "falta MONGODB_URI en $REMOTO/.env (ssh -i $LLAVE $ANFITRION nano $REMOTO/.env)"
# API_URL sigue al dominio (QvaPay avisa los pagos ahi); es lo unico del .env que se actualiza.
remoto "sed -i 's|^API_URL=.*|API_URL=https://$DOMINIO|' $REMOTO/.env"

paso "Armando y arrancando el contenedor"
remoto "cd $REMOTO && rm -rf app.nuevo && mkdir app.nuevo && tar -xzf app.tar.gz -C app.nuevo && rm app.tar.gz \
	&& rm -rf app.anterior && { [ ! -d app ] || mv app app.anterior; } && mv app.nuevo app \
	&& docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null"

paso "Esperando a que el backend responda"
salud=""
for _ in $(seq 1 30); do
	salud=$(ssh "${SSH_OPC[@]}" "$ANFITRION" "docker inspect -f '{{.State.Health.Status}}' reservas" 2>/dev/null || true)
	[[ $salud == healthy ]] && break
	sleep 3
done
if [[ $salud != healthy ]]; then
	ssh "${SSH_OPC[@]}" "$ANFITRION" "docker logs --tail 40 reservas" || true
	fallar "el backend no quedo sano ($salud). Si dice que no conecta a Mongo: agrega la IP $IP en Atlas -> Network Access."
fi

# Solo se toca Caddy si el sitio cambio. revisar-sitios.sh aparta un .caddy roto para no tumbar Up.
if ! ssh "${SSH_OPC[@]}" "$ANFITRION" "cmp -s $REMOTO/reservas.caddy /opt/up/sitios/reservas.caddy"; then
	paso "Publicando $DOMINIO en el Caddy de Up"
	remoto "cp $REMOTO/reservas.caddy /opt/up/sitios/reservas.caddy && bash /opt/up/revisar-sitios.sh \
		&& cd /opt/up && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile"
fi

paso "Probando https://$DOMINIO/health"
if curl -fsS --max-time 20 "https://$DOMINIO/health"; then
	echo
	echo "Listo: version $version en https://$DOMINIO"
else
	echo "El contenedor esta sano, pero https://$DOMINIO todavia no responde."
	echo "Si es un dominio propio: revisa que su registro DNS tipo A apunte a $IP (el certificado tarda ~1 min)."
fi
