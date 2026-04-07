const API_KEY = "YOUR_API_KEY";
const EntityOtherPlayerMP = Java.type("net.minecraft.client.entity.EntityOtherPlayerMP");
const URL = Java.type("java.net.URL");
const BufferedReader = Java.type("java.io.BufferedReader");
const InputStreamReader = Java.type("java.io.InputStreamReader");

let targetName = "";
let targetStats = null;
let isFetching = false;
let cache = {};
let forceTestHUD = false; // Pour la commande /testhud

function getNetworkLevel(exp) {
    return (Math.sqrt(exp + 15312.5) - 125 / Math.sqrt(2)) / (25 * Math.sqrt(2));
}

function fetchStats(uuid, name) {
    if (cache[uuid]) {
        targetStats = cache[uuid];
        return;
    }

    if (isFetching) return;
    isFetching = true;
    targetStats = null;

    new Thread(() => {
        try {
            // Nouvelle méthode de connexion sécurisée (API Hypixel moderne)
            let connection = new URL("https://api.hypixel.net/player?uuid=" + uuid).openConnection();
            connection.setRequestProperty("API-Key", API_KEY);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");
            
            let reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            let line;
            let response = "";
            while ((line = reader.readLine()) !== null) {
                response += line;
            }
            reader.close();

            let json = JSON.parse(response);

            if (json.success && json.player) {
                let p = json.player;
                let bw = p.stats && p.stats.Bedwars ? p.stats.Bedwars : {};
                
                let fk = bw.final_kills_bedwars || 0;
                let fd = bw.final_deaths_bedwars || 1;
                let fkdr = (fk / fd).toFixed(2);

                targetStats = {
                    level: Math.floor(getNetworkLevel(p.networkExp || 0)),
                    karma: p.karma || 0,
                    bwWins: bw.wins_bedwars || 0,
                    bwFkdr: fkdr
                };
                cache[uuid] = targetStats;
            } else {
                targetStats = { error: "&cJoueur introuvable" };
            }
        } catch (e) {
            targetStats = { error: "&cErreur API (Clé invalide?)" };
        }
        isFetching = false;
    }).start();
}

register("tick", () => {
    let lookingAt = Player.lookingAt();
    
    // Vérification blindée : On s'assure qu'on regarde bien une "Entité" et que c'est un "Vrai Joueur" (EntityOtherPlayerMP)
    if (lookingAt && typeof lookingAt.getEntity === "function") {
        let baseEntity = lookingAt.getEntity();
        
        if (baseEntity instanceof EntityOtherPlayerMP) {
            let name = lookingAt.getName();
            let uuid = lookingAt.getUUID().toString().replace(/-/g, "");
            
            if (name !== targetName) {
                targetName = name;
                fetchStats(uuid, name);
            }
            return; // On arrête là, on a trouvé notre cible
        }
    }
    
    // Si on ne regarde pas un joueur, on réinitialise
    if (!forceTestHUD) {
        targetName = "";
        targetStats = null;
    }
});

// Le HUD qui s'affiche à l'écran
register("renderOverlay", () => {
    if (!targetName && !forceTestHUD) return;

    let x = Renderer.screen.getWidth() / 2 + 25;  // À droite du viseur
    let y = Renderer.screen.getHeight() / 2;      // Au niveau du viseur

    if (forceTestHUD) {
        Renderer.drawStringWithShadow("&e&lCible: &fJoueurTest", x, y);
        Renderer.drawStringWithShadow("&bNiveau Hypixel: &a150", x, y + 12);
        Renderer.drawStringWithShadow("&dKarma: &a500000", x, y + 22);
        Renderer.drawStringWithShadow("&cFKDR Bedwars: &a3.45", x, y + 32);
        return;
    }

    Renderer.drawStringWithShadow(`&e&lCible: &f${targetName}`, x, y);

    if (isFetching && !targetStats) {
        Renderer.drawStringWithShadow(`&7Chargement...`, x, y + 12);
    } else if (targetStats) {
        if (targetStats.error) {
            Renderer.drawStringWithShadow(targetStats.error, x, y + 12);
        } else {
            Renderer.drawStringWithShadow(`&bNiveau Hypixel: &a${targetStats.level}`, x, y + 12);
            Renderer.drawStringWithShadow(`&dKarma: &a${targetStats.karma}`, x, y + 22);
            Renderer.drawStringWithShadow(`&cFKDR Bedwars: &a${targetStats.bwFkdr}`, x, y + 32);
            Renderer.drawStringWithShadow(`&6Victoires Bedwars: &a${targetStats.bwWins}`, x, y + 42);
        }
    }
});

// Commande de test pour vérifier que le HUD s'affiche bien
register("command", () => {
    forceTestHUD = !forceTestHUD;
    ChatLib.chat(forceTestHUD ? "&aHUD de test activé !" : "&cHUD de test désactivé !");
}).setName("testhud");
