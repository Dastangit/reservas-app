// Fuerza a Node a resolver DNS via 8.8.8.8/1.1.1.1 en vez del DNS de la
// VPN corporativa (que no resuelve bien registros SRV de MongoDB Atlas).
// Solo afecta al proceso de Node que lo carga -- no toca la config de
// Windows ni la VPN. Uso: node -r ./scripts/dns-fix.js <script>
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
