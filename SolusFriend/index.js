import PogObject from "PogData";

// --- CONFIGURATION ---
const prefix = "§2[LocalFriends] ";
const GITHUB_BASE = "https://raw.githubusercontent.com/OblivionFR/Oblivion/main/FriendModule/";

// Sauvegarde Locale
const data = new PogObject("SimpleFriend", {
    friends: [],
    pvpEnabled: false
}, "data.json");

// Listes Cloud
let cloudFriends = [];
let cloudInvincibles = [];
let lastUpdate = 0;

// --- 1. GESTION DU CLOUD (SILENCIEUSE) ---
function fetchList(filename, time) {
    try {
        let content = FileLib.getUrlContent(GITHUB_BASE + filename + time);
        if (!content) return [];
        return content.split("\n")
            .map(s => s.replace(/[^a-zA-Z0-9_]/g, "").trim())
            .filter(s => s.length >= 3);
    } catch (e) { return []; }
}

function updateCloud(silent = true) {
    new Thread(() => {
        if (!silent) ChatLib.chat(prefix + "§7Synchronisation...");
        
        // Anti-cache param
        let t = "?t=" + Date.now();
        cloudFriends = fetchList("default_friend.txt", t);
        cloudInvincibles = fetchList("invincible.txt", t);
        
        lastUpdate = Date.now();
        if (!silent) ChatLib.chat(prefix + "§aCloud à jour ! (" + (cloudFriends.length + cloudInvincibles.length) + " entrées)");
    }).start();
}

// Mise à jour auto toutes les 60s (SILENCIEUSE)
register("step", () => {
    if (Date.now() - lastUpdate > 60000) updateCloud(true);
}).setDelay(5);

// Update au lancement
updateCloud(true);

// --- 2. LOGIQUE ---
function getStatus(name) {
    if (!name) return "NONE";
    let n = ChatLib.removeFormatting(name).toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (cloudInvincibles.some(x => x.toLowerCase() === n)) return "INVINCIBLE";
    if (data.friends.some(x => x.toLowerCase() === n)) return "FRIEND";
    if (cloudFriends.some(x => x.toLowerCase() === n)) return "FRIEND";
    
    return "NONE";
}

// --- 3. INTERACTION RAPIDE (SNEAK + CLIC DROIT) ---
register("clicked", (x, y, button, isDown) => {
    // Bouton 1 = Clic Droit
    if (isDown && button === 1 && Player.isSneaking()) {
        let mc = Client.getMinecraft();
        let objectMouseOver = mc.field_147125_j; // MovingObjectPosition

        if (objectMouseOver != null && objectMouseOver.field_72313_a == "ENTITY") {
            let entityHit = objectMouseOver.field_72308_g;
            // Vérifie si c'est un joueur
            if (entityHit instanceof Java.type("net.minecraft.entity.player.EntityPlayer")) {
                let name = ChatLib.removeFormatting(entityHit.func_70005_c_());
                
                // On ne s'ajoute pas soi-même
                if (name !== Player.getName()) {
                    // Toggle Ami
                    if (data.friends.includes(name)) {
                        data.friends = data.friends.filter(f => f !== name);
                        data.save();
                        ChatLib.chat(prefix + "§c" + name + " retiré avec succès.");
                        World.playSound("random.break", 1, 1);
                    } else {
                        // On vérifie si c'est déjà un ami Cloud (impossible à gérer localement)
                        if (getStatus(name) !== "NONE") {
                            ChatLib.chat(prefix + "§e" + name + " est déjà dans le Cloud !");
                        } else {
                            data.friends.push(name);
                            data.save();
                            ChatLib.chat(prefix + "§a" + name + " ajouté avec succès !");
                            World.playSound("random.orb", 1, 1);
                        }
                    }
                }
            }
        }
    }
});

// --- 4. COMMANDES ---
register("command", (...args) => {
    if (!args || args.length === 0) {
        ChatLib.chat("§2§m---------------------------------------------");
        ChatLib.chat("§2§lSimpleFriend §7(v2.0)");
        ChatLib.chat("§a/lf add <pseudo>    §7- Ajouter ami");
        ChatLib.chat("§a/lf remove <pseudo> §7- Retirer ami");
        ChatLib.chat("§a/lf list            §7- Voir listes");
        ChatLib.chat("§a/lf pvp             §7- Toggle PvP (" + (data.pvpEnabled ? "§cON" : "§aOFF") + ")");
        ChatLib.chat("§a/lf force           §7- Force Update Cloud");
        ChatLib.chat("§7Astuce: Sneak + Clic Droit sur un joueur pour l'ajouter !");
        ChatLib.chat("§2§m---------------------------------------------");
        return;
    }

    let action = args[0].toLowerCase();
    let pseudo = args[1];

    if (action === "add" && pseudo) {
        if (!data.friends.includes(pseudo)) {
            data.friends.push(pseudo); data.save();
            ChatLib.chat(prefix + "§a" + pseudo + " ajouté.");
        } else ChatLib.chat(prefix + "§cDéjà ami.");
    }
    else if (action === "remove" && pseudo) {
        data.friends = data.friends.filter(x => x.toLowerCase() !== pseudo.toLowerCase());
        data.save();
        ChatLib.chat(prefix + "§c" + pseudo + " retiré.");
    }
    else if (action === "list") {
        ChatLib.chat("§6Cloud Invincibles ("+cloudInvincibles.length+"): §d" + cloudInvincibles.join(", "));
        ChatLib.chat("§6Cloud Amis ("+cloudFriends.length+"): §a" + cloudFriends.join(", "));
        ChatLib.chat("§2Local Amis ("+data.friends.length+"): §a" + data.friends.join(", "));
    }
    else if (action === "pvp") {
        data.pvpEnabled = !data.pvpEnabled; data.save();
        ChatLib.chat(prefix + "PvP Ami : " + (data.pvpEnabled ? "§cACTIVÉ (Tu peux taper)" : "§aDÉSACTIVÉ (Sécurité)"));
    }
    else if (action === "force") {
        updateCloud(false); // false = affiche le message
    }
}).setName("localfriend").setAliases("lf");

// --- 5. GAMEPLAY (ANTI-HIT) ---
register("attackEntity", (entity, event) => {
    if (entity.getClassName() !== "EntityOtherPlayerMP") return;

    let name = entity.getName();
    let status = getStatus(name);

    if (status === "INVINCIBLE") {
        cancel(event);
        World.playSound("mob.enderdragon.hit", 1, 0.5);
    }
    else if (status === "FRIEND" && !data.pvpEnabled) {
        cancel(event);
        World.playSound("random.anvil_land", 1, 0.5);
    }
});

// --- 6. VISUELS (ESP, TAB, CHAT) ---

// Chat Highlight
register("chat", (event) => {
    let msg = ChatLib.getChatMessage(event);
    // On ne traite pas si c'est nous (évite boucle)
    if (msg.includes(Player.getName())) return;

    // Check rapide
    let clean = ChatLib.removeFormatting(msg);
    let all = [...data.friends, ...cloudFriends, ...cloudInvincibles];
    
    all.forEach(f => {
        if (clean.includes(f)) {
            cancel(event);
            let st = getStatus(f);
            let col = st === "INVINCIBLE" ? "§d§l" : "§a§l";
            // Remplace le nom par le nom coloré
            ChatLib.chat(msg.replace(new RegExp(f, "g"), col + f + "§r"));
        }
    });
});

// Tablist
register("tick", () => {
    if (!World.isLoaded()) return;
    try {
        let sb = World.getWorld().func_96441_U();
        
        let tGod = sb.func_96508_e("0_GOD") || sb.func_96527_f("0_GOD"); tGod.func_96666_b("§d§lGOD §d");
        let tFri = sb.func_96508_e("1_FRI") || sb.func_96527_f("1_FRI"); tFri.func_96666_b("§a[Ami] §a");

        let netHandler = Client.getMinecraft().func_147114_u();
        let playerMap = netHandler.func_175106_d(); 

        for (let info of playerMap) {
            let name = info.func_178845_a().getName();
            let st = getStatus(name);

            if (st !== "NONE") {
                let teamName = st === "INVINCIBLE" ? "0_GOD" : "1_FRI";
                let teamObj = st === "INVINCIBLE" ? tGod : tFri;
                let col = st === "INVINCIBLE" ? "§d" : "§a";

                if (!teamObj.func_96665_g().contains(name)) sb.func_151392_a(name, teamName);

                let dn = info.func_178854_k();
                if (dn == null || dn.func_150254_d().indexOf(col) == -1) {
                     let CCT = Java.type("net.minecraft.util.ChatComponentText");
                     info.func_178859_a(new CCT(col + name));
                }
            }
        }
    } catch(e) {}
});

// ESP 3D
register("renderWorld", () => {
    World.getAllPlayers().forEach(p => {
        if (p.getName() === Player.getName()) return;
        let st = getStatus(p.getName());
        
        if (st !== "NONE") {
            let dist = Math.round(Player.asPlayerMP().distanceTo(p));
            if (dist < 50) {
                let txt = st === "INVINCIBLE" ? "§d§l★ INVINCIBLE ★" : "§a★ AMI ★";
                let x = p.getRenderX();
                let y = p.getRenderY() + p.getHeight() + 0.5;
                let z = p.getRenderZ();
                
                Tessellator.drawString(txt + " §7(" + dist + "m)", x, y, z, 0, true, 0.04, false);
            }
        }
    });
});
